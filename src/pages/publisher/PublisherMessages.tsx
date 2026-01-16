import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Home, Users, Settings, Send, MessageSquare } from "lucide-react";
import { PublisherLayout } from "@/components/publisher/PublisherLayout";
import { BackNavigation, TabNavigation, StatusBadge, FormSelect, EmptyState } from "@/components/neesh";

const tabs = [
  { id: "retailers", label: "Retailers" },
  { id: "support", label: "Support" },
];

const mockConversations = [
  { id: "1", name: "Brooklyn Books", avatar: "/placeholder.svg", lastMessage: "Thanks for the quick ship...", unread: true },
  { id: "2", name: "Powell's Books", avatar: "/placeholder.svg", lastMessage: "Can we discuss the...", unread: false },
  { id: "3", name: "Strand Bookstore", avatar: "/placeholder.svg", lastMessage: "Order received, looks...", unread: false },
  { id: "4", name: "City Lights", avatar: "/placeholder.svg", lastMessage: "When will the next issue...", unread: true },
];

const mockMessages = [
  { id: "1", sender: "them", text: "Hi! We received the shipment of Kinfolk Issue 45. Everything looks great!", time: "10:30 AM" },
  { id: "2", sender: "me", text: "Wonderful! Let me know if you need anything else.", time: "10:35 AM" },
  { id: "3", sender: "them", text: "Actually, we were wondering if you have Issue 44 still in stock? A customer is looking for it.", time: "10:40 AM" },
  { id: "4", sender: "me", text: "Yes, we have about 50 copies remaining. Would you like to add that to your next order?", time: "10:45 AM" },
  { id: "5", sender: "them", text: "That would be perfect. Can we get 20 copies?", time: "10:50 AM" },
];

const mockTickets = [
  { id: "1", status: "pending" as const, title: "Shipping Delay Inquiry" },
  { id: "2", status: "received" as const, title: "Return Request - Issue 43" },
  { id: "3", status: "unfulfilled" as const, title: "Payment Question" },
];

export const PublisherMessages = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("retailers");
  const [selectedConversation, setSelectedConversation] = useState(mockConversations[0]);
  const [messageInput, setMessageInput] = useState("");

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      console.log("Sending:", messageInput);
      setMessageInput("");
    }
  };

  return (
    <PublisherLayout>
      <BackNavigation
        title=""
        onBack={() => navigate("/publisher")}
      />

      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex h-[calc(100vh-180px)]">
        {/* Left Sidebar - Icons */}
        <div className="w-16 border-r border-border flex flex-col items-center py-4 gap-4">
          <button className="p-3 rounded-lg hover:bg-secondary transition-colors">
            <Home className="w-5 h-5 text-foreground" />
          </button>
          <button className="p-3 rounded-lg bg-secondary">
            <Users className="w-5 h-5 text-foreground" />
          </button>
          <button className="p-3 rounded-lg hover:bg-secondary transition-colors">
            <Settings className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="w-72 border-r border-border flex flex-col">
          <div className="p-4 border-b border-border">
            <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-body">Back</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {mockConversations.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<MessageSquare className="w-12 h-12" />}
                  title="No messages"
                  description="Conversations with Neesh and retailers will appear here"
                />
              </div>
            ) : (
            mockConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-secondary transition-colors ${
                  selectedConversation.id === conv.id ? "bg-secondary" : ""
                }`}
              >
                <div className="relative">
                  <img
                    src={conv.avatar}
                    alt={conv.name}
                    className="w-10 h-10 rounded-full bg-secondary"
                  />
                  {conv.unread && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-display font-medium text-body text-foreground truncate">
                    {conv.name}
                  </p>
                  <p className="text-caption text-muted-foreground truncate">
                    {conv.lastMessage}
                  </p>
                </div>
              </button>
            ))
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mockMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${msg.sender === "me" ? "flex-row-reverse" : ""}`}
              >
                {msg.sender === "them" && (
                  <img
                    src={selectedConversation.avatar}
                    alt={selectedConversation.name}
                    className="w-8 h-8 rounded-full bg-secondary"
                  />
                )}
                <div className={`max-w-[70%] ${msg.sender === "me" ? "text-right" : ""}`}>
                  <div
                    className={`inline-block px-4 py-2 rounded-lg ${
                      msg.sender === "me"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground"
                    }`}
                  >
                    <p className="text-body">{msg.text}</p>
                  </div>
                  <p className="text-caption text-muted-foreground mt-1">{msg.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Send a message"
                className="input-neesh flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                className="p-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Customer Info */}
        <div className="w-80 border-l border-border p-4 overflow-y-auto hidden xl:block">
          {/* Customer Profile */}
          <div className="text-center mb-6">
            <img
              src={selectedConversation.avatar}
              alt={selectedConversation.name}
              className="w-16 h-16 rounded-full bg-secondary mx-auto mb-3"
            />
            <h3 className="font-display font-semibold text-heading text-foreground">
              {selectedConversation.name}
            </h3>
          </div>

          {/* Ticket History */}
          <div className="mb-6">
            <h4 className="font-display font-semibold text-body text-foreground mb-3">
              Customer Ticket History
            </h4>
            <div className="space-y-2">
              {mockTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between py-2">
                  <span className="text-caption text-foreground truncate flex-1 mr-2">
                    {ticket.title}
                  </span>
                  <StatusBadge status={ticket.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Consultation Detail Form */}
          <div>
            <h4 className="font-display font-semibold text-body text-foreground mb-3">
              Consultation Detail
            </h4>
            <div className="space-y-3">
              <FormSelect
                label="Service"
                placeholder="Select service"
                options={[
                  { value: "order", label: "Order Support" },
                  { value: "returns", label: "Returns" },
                  { value: "billing", label: "Billing" },
                ]}
              />
              <FormSelect
                label="Consultation Type"
                placeholder="Select type"
                options={[
                  { value: "inquiry", label: "Inquiry" },
                  { value: "complaint", label: "Complaint" },
                  { value: "request", label: "Request" },
                ]}
              />
              <FormSelect
                label="Sub Category"
                placeholder="Select category"
                options={[
                  { value: "shipping", label: "Shipping" },
                  { value: "product", label: "Product" },
                  { value: "payment", label: "Payment" },
                ]}
              />
              <div>
                <label className="block mb-1.5 font-display font-medium text-body text-foreground">
                  Customer's Request
                </label>
                <textarea
                  className="input-neesh w-full h-24 resize-none"
                  placeholder="Enter customer request details..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublisherLayout>
  );
};

export default PublisherMessages;
