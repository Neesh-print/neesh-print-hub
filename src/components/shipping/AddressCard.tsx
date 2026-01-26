import { Pencil, Trash2, Star, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getStateLabel, getCountryLabel } from '@/lib/geography';
import type { ShippingAddress } from '@/types/shipping';

interface AddressCardProps {
  address: ShippingAddress;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isDeleting?: boolean;
}

export function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  isDeleting = false,
}: AddressCardProps) {
  return (
    <div className={cn(
      "border rounded-lg p-4 space-y-3",
      address.is_default && "border-primary bg-primary/5"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {address.label || 'Shipping Address'}
          </span>
          {address.is_verified && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
        {address.is_default && (
          <Badge>Default</Badge>
        )}
      </div>

      {/* Address Details */}
      <div className="text-sm space-y-1">
        <p className="font-medium">{address.recipient_name}</p>
        {address.company_name && (
          <p className="text-muted-foreground">{address.company_name}</p>
        )}
        <p>{address.address_line_1}</p>
        {address.address_line_2 && <p>{address.address_line_2}</p>}
        <p>
          {address.city}, {getStateLabel(address.state) || address.state} {address.postal_code}
        </p>
        <p>{getCountryLabel(address.country) || address.country}</p>
      </div>

      {/* Phone */}
      {address.phone && (
        <p className="text-sm text-muted-foreground">
          {address.phone}
        </p>
      )}

      {/* Delivery Instructions */}
      {address.delivery_instructions && (
        <p className="text-sm italic text-muted-foreground">
          "{address.delivery_instructions}"
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onDelete}
          disabled={isDeleting}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </Button>
        {!address.is_default && (
          <Button variant="ghost" size="sm" onClick={onSetDefault}>
            <Star className="w-4 h-4 mr-1" />
            Set Default
          </Button>
        )}
      </div>
    </div>
  );
}
