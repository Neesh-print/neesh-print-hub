import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { RetailerLayout } from '@/components/retailer/RetailerLayout';
import { BackNavigation, EmptyState } from '@/components/neesh';
import { Button } from '@/components/ui/button';
import { ShippingAddressForm, AddressCard } from '@/components/shipping';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useShippingAddresses,
  useCreateShippingAddress,
  useUpdateShippingAddress,
  useDeleteShippingAddress,
  useSetDefaultAddress,
} from '@/hooks/useShippingAddresses';
import type { ShippingAddress, ShippingAddressFormData } from '@/types/shipping';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const RetailerShippingAddresses = () => {
  const navigate = useNavigate();
  const { data: addresses, isLoading } = useShippingAddresses();
  
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null);
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);

  const createMutation = useCreateShippingAddress();
  const updateMutation = useUpdateShippingAddress();
  const deleteMutation = useDeleteShippingAddress();
  const setDefaultMutation = useSetDefaultAddress();

  const handleBack = () => {
    navigate('/retailer/settings');
  };

  const handleCreate = async (data: ShippingAddressFormData) => {
    try {
      await createMutation.mutateAsync(data);
      setIsAddingAddress(false);
      toast.success('Address added successfully');
    } catch (error) {
      toast.error('Failed to add address');
    }
  };

  const handleUpdate = async (data: ShippingAddressFormData) => {
    if (!editingAddress) return;
    try {
      await updateMutation.mutateAsync({ id: editingAddress.id, ...data });
      setEditingAddress(null);
      toast.success('Address updated successfully');
    } catch (error) {
      toast.error('Failed to update address');
    }
  };

  const handleDelete = async () => {
    if (!deletingAddressId) return;
    try {
      await deleteMutation.mutateAsync(deletingAddressId);
      setDeletingAddressId(null);
      toast.success('Address deleted');
    } catch (error) {
      toast.error('Failed to delete address');
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await setDefaultMutation.mutateAsync(addressId);
      toast.success('Default address updated');
    } catch (error) {
      toast.error('Failed to update default address');
    }
  };

  const isFirstAddress = !addresses || addresses.length === 0;

  return (
    <RetailerLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <BackNavigation
          title="Shipping Addresses"
          onBack={handleBack}
        />

        <p className="text-muted-foreground mb-6">
          Manage where publishers send your orders.
        </p>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {/* Add New Address Button */}
        {!isLoading && !isFirstAddress && !isAddingAddress && !editingAddress && (
          <div className="mb-6">
            <Button onClick={() => setIsAddingAddress(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add New Address
            </Button>
          </div>
        )}

        {/* Add Address Form */}
        {isAddingAddress && (
          <div className="card-neesh mb-6">
            <h2 className="text-lg font-semibold mb-4">Add New Address</h2>
            <ShippingAddressForm
              onSubmit={handleCreate}
              onCancel={() => setIsAddingAddress(false)}
              isFirstAddress={isFirstAddress}
              isSubmitting={createMutation.isPending}
            />
          </div>
        )}

        {/* Edit Address Form */}
        {editingAddress && (
          <div className="card-neesh mb-6">
            <h2 className="text-lg font-semibold mb-4">Edit Address</h2>
            <ShippingAddressForm
              initialData={editingAddress}
              onSubmit={handleUpdate}
              onCancel={() => setEditingAddress(null)}
              isSubmitting={updateMutation.isPending}
            />
          </div>
        )}

        {/* Address List */}
        {!isLoading && !isAddingAddress && !editingAddress && (
          <>
            {isFirstAddress ? (
              <EmptyState
                icon={<Package className="w-12 h-12" />}
                title="No shipping addresses yet"
                description="Add an address so publishers know where to send your orders."
                action={
                  <Button onClick={() => setIsAddingAddress(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Address
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {addresses?.map((address) => (
                  <AddressCard
                    key={address.id}
                    address={address}
                    onEdit={() => setEditingAddress(address)}
                    onDelete={() => setDeletingAddressId(address.id)}
                    onSetDefault={() => handleSetDefault(address.id)}
                    isDeleting={deleteMutation.isPending && deletingAddressId === address.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog 
          open={!!deletingAddressId} 
          onOpenChange={() => setDeletingAddressId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Address</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this shipping address? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RetailerLayout>
  );
};

export default RetailerShippingAddresses;
