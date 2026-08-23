import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsletterRequest {
  newsletterId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client for user auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { newsletterId }: NewsletterRequest = await req.json();

    // Initialize service client for database operations
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get newsletter details
    const { data: newsletter, error: newsletterError } = await supabaseService
      .from('newsletters')
      .select(`
        *,
        publisher:profiles!newsletters_publisher_id_fkey(business_name, first_name, last_name, email)
      `)
      .eq('id', newsletterId)
      .eq('publisher_id', user.id) // Ensure user owns this newsletter
      .single();

    if (newsletterError || !newsletter) {
      throw new Error('Newsletter not found or access denied');
    }

    if (newsletter.status === 'sent') {
      throw new Error('Newsletter has already been sent');
    }

    // Get recipient list based on target audience
    let recipientQuery = supabaseService
      .from('profiles')
      .select('id, email, business_name, first_name, last_name');

    if (newsletter.target_audience === 'specific_retailers' && newsletter.specific_recipients) {
      recipientQuery = recipientQuery.in('id', newsletter.specific_recipients);
    } else if (newsletter.target_audience === 'active_customers') {
      // Get retailers who have placed orders with this publisher
      recipientQuery = recipientQuery
        .eq('role', 'retailer')
        .in('id',
          supabaseService
            .from('orders')
            .select('retailer_id')
            .in('id',
              supabaseService
                .from('order_item')
                .select('order_id')
                .in('product_id',
                  supabaseService
                    .from('products')
                    .select('id')
                    .eq('publisher_id', user.id)
                )
            )
        );
    } else {
      // All retailers
      recipientQuery = recipientQuery.eq('role', 'retailer');
    }

    const { data: recipients, error: recipientsError } = await recipientQuery;

    if (recipientsError) throw recipientsError;

    if (!recipients || recipients.length === 0) {
      throw new Error('No recipients found for this newsletter');
    }

    // Filter recipients based on newsletter preferences
    const { data: preferences } = await supabaseService
      .from('notification_preferences')
      .select('user_id, email_newsletters')
      .in('user_id', recipients.map(r => r.id));

    const preferencesMap = new Map(preferences?.map(p => [p.user_id, p.email_newsletters]) || []);
    const eligibleRecipients = recipients.filter(recipient =>
      preferencesMap.get(recipient.id) !== false
    );

    if (eligibleRecipients.length === 0) {
      throw new Error('No recipients have newsletter emails enabled');
    }

    // Initialize Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

    const siteUrl = Deno.env.get('SITE_URL') || 'https://neesh.art';

    // Create email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-bottom: 3px solid #1a202c;">
          <h1 style="color: #333; margin: 0;">
            ${newsletter.publisher.business_name || newsletter.publisher.first_name}
          </h1>
          <p style="color: #666; margin: 5px 0 0 0;">Publisher Update</p>
        </div>

        <div style="padding: 30px 20px;">
          <h2 style="color: #333; margin-bottom: 20px;">${newsletter.title}</h2>

          <div style="line-height: 1.6; color: #444;">
            ${newsletter.content.replace(/\n/g, '<br>')}
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            This newsletter was sent by ${newsletter.publisher.business_name || newsletter.publisher.first_name} via Neesh
          </p>
          <p style="margin: 10px 0 0 0; font-size: 12px;">
            <a href="${siteUrl}/settings/notifications"
               style="color: #1a202c; text-decoration: underline;">
              Manage email preferences or unsubscribe
            </a>
          </p>
          <p style="margin: 10px 0 0 0; color: #999; font-size: 11px;">
            Neesh is operated by WAU LLC, c/o Registered Agents Inc, 2355 State St STE 101, Salem, OR 97301, USA
          </p>
        </div>
      </div>
    `;

    // Send emails in batches to avoid rate limits
    const batchSize = 10;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < eligibleRecipients.length; i += batchSize) {
      const batch = eligibleRecipients.slice(i, i + batchSize);

      const emailPromises = batch.map(async (recipient) => {
        try {
          await resend.emails.send({
            from: `${newsletter.publisher.business_name || newsletter.publisher.first_name} via Neesh <hi@neesh.art>`,
            to: [recipient.email],
            subject: newsletter.title,
            html: emailHtml
          });

          // Create notification for each recipient
          await supabaseService
            .from('notifications')
            .insert({
              user_id: recipient.id,
              title: `Newsletter: ${newsletter.title}`,
              content: `New newsletter from ${newsletter.publisher.business_name || newsletter.publisher.first_name}`,
              notification_type: 'newsletter',
              email_sent: true
            });

          sentCount++;
        } catch (error) {
          console.error(`Failed to send newsletter to ${recipient.email}:`, error);
          failedCount++;
        }
      });

      await Promise.all(emailPromises);

      // Small delay between batches
      if (i + batchSize < eligibleRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Update newsletter status
    await supabaseService
      .from('newsletters')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', newsletterId);

    return new Response(JSON.stringify({
      success: true,
      sentCount,
      failedCount,
      totalRecipients: eligibleRecipients.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in send-newsletter function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
