import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  Package,
  AlertTriangle,
  TrendingDown,
  Eye,
  ExternalLink,
  Upload,
  Pencil,
  Ban,
  Archive,
  RotateCcw,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

type MagazineStatus = 'active' | 'suspended' | 'archived';

interface Magazine {
  id: string;
  title: string;
  cover_image_url: string | null;
  inventory_count: number | null;
  minimum_order_quantity: number | null;
  fulfillment_method: 'publisher_handled' | 'neesh_handled';
  price: number | null;
  wholesale_price: number | null;
  description: string | null;
  publisher_id: string;
  is_active: boolean | null;
  publisher: {
    company_name: string;
  };
}

function getMagazineStatus(is_active: boolean | null): MagazineStatus {
  if (is_active === true) return 'active';
  if (is_active === false) return 'archived';
  return 'suspended'; // is_active === null
}

type FilterType = 'all' | 'active' | 'suspended' | 'archived' | 'low_stock' | 'out_of_stock';

export function AdminMagazines() {
  const navigate = useNavigate();
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedMagazine, setSelectedMagazine] = useState<Magazine | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    magazineId: string;
    title: string;
    action: 'suspend' | 'archive' | 'reactivate';
  } | null>(null);

  const fetchMagazines = useCallback(async () => {
    setLoading(true);
    try {
      const query = supabase
        .from('magazines')
        .select(`
          id,
          title,
          cover_image_url,
          inventory_count,
          minimum_order_quantity,
          fulfillment_method,
          price,
          wholesale_price,
          description,
          publisher_id,
          is_active,
          publisher:publishers(company_name)
        `)
        .order('title');

      const { data, error } = await query;

      if (error) throw error;
      setMagazines(data as unknown as Magazine[] || []);
    } catch (error) {
      console.error('Error fetching magazines:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMagazines();
  }, [fetchMagazines]);

  // Close action menu when clicking outside
  useEffect(() => {
    if (!actionMenuId) return;
    const handler = () => setActionMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [actionMenuId]);

  const updateMagazineStatus = async (magazineId: string, newIsActive: boolean | null) => {
    const { error } = await supabase
      .from('magazines')
      .update({ is_active: newIsActive, updated_at: new Date().toISOString() })
      .eq('id', magazineId);

    if (error) {
      toast.error(`Failed to update magazine: ${error.message}`);
      return;
    }

    const label = newIsActive === true ? 'reactivated' : newIsActive === false ? 'archived' : 'suspended';
    toast.success(`Magazine ${label}`);
    setConfirmAction(null);
    setSelectedMagazine(null);
    fetchMagazines();
  };

  // Counts
  const activeCount = magazines.filter((m) => getMagazineStatus(m.is_active) === 'active').length;
  const suspendedCount = magazines.filter((m) => getMagazineStatus(m.is_active) === 'suspended').length;
  const archivedCount = magazines.filter((m) => getMagazineStatus(m.is_active) === 'archived').length;

  const activeMagazines = magazines.filter((m) => getMagazineStatus(m.is_active) === 'active');
  const lowStockCount = activeMagazines.filter(
    (m) => m.fulfillment_method === 'publisher_handled' && m.inventory_count !== null && m.inventory_count > 0 && m.inventory_count <= 10
  ).length;
  const outOfStockCount = activeMagazines.filter(
    (m) => m.fulfillment_method === 'publisher_handled' && (m.inventory_count === null || m.inventory_count <= 0)
  ).length;

  // Apply filter
  const filteredMagazines = magazines.filter((m) => {
    const status = getMagazineStatus(m.is_active);
    switch (filter) {
      case 'active':
        return status === 'active';
      case 'suspended':
        return status === 'suspended';
      case 'archived':
        return status === 'archived';
      case 'low_stock':
        return status === 'active' && m.fulfillment_method === 'publisher_handled' &&
          m.inventory_count !== null && m.inventory_count > 0 && m.inventory_count <= 10;
      case 'out_of_stock':
        return status === 'active' && m.fulfillment_method === 'publisher_handled' &&
          (m.inventory_count === null || m.inventory_count <= 0);
      default:
        return true;
    }
  });

  const getPublisherName = (magazine: Magazine) =>
    Array.isArray(magazine.publisher)
      ? (magazine.publisher as unknown as { company_name: string }[])[0]?.company_name
      : magazine.publisher?.company_name || 'Unknown';

  return (
    <AdminLayout>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Magazines</h1>
          <p className="text-gray-600 mt-2">Manage all magazine listings across publishers</p>
        </div>
        <button
          onClick={() => navigate('/admin/magazines/import')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{magazines.length}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-semibold text-green-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Suspended</p>
          <p className="text-2xl font-semibold text-amber-600 mt-1">{suspendedCount}</p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Archived</p>
          <p className="text-2xl font-semibold text-gray-400 mt-1">{archivedCount}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {([
          { key: 'all', label: 'All', count: magazines.length, activeClass: 'bg-gray-900 text-white' },
          { key: 'active', label: 'Active', count: activeCount, activeClass: 'bg-green-600 text-white' },
          { key: 'suspended', label: 'Suspended', count: suspendedCount, activeClass: 'bg-amber-600 text-white' },
          { key: 'archived', label: 'Archived', count: archivedCount, activeClass: 'bg-gray-500 text-white' },
          { key: 'low_stock', label: 'Low Stock', count: lowStockCount, activeClass: 'bg-amber-600 text-white' },
          { key: 'out_of_stock', label: 'Out of Stock', count: outOfStockCount, activeClass: 'bg-red-600 text-white' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
              filter === tab.key
                ? tab.activeClass
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Magazine Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Magazine
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Publisher
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Inventory
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pricing
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  Loading magazines...
                </td>
              </tr>
            ) : filteredMagazines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No magazines found
                </td>
              </tr>
            ) : (
              filteredMagazines.map((magazine) => {
                const status = getMagazineStatus(magazine.is_active);
                const isLowStock =
                  status === 'active' &&
                  magazine.fulfillment_method === 'publisher_handled' &&
                  magazine.inventory_count !== null &&
                  magazine.inventory_count > 0 &&
                  magazine.inventory_count <= 10;
                const isOutOfStock =
                  status === 'active' &&
                  magazine.fulfillment_method === 'publisher_handled' &&
                  (magazine.inventory_count === null || magazine.inventory_count <= 0);

                return (
                  <tr
                    key={magazine.id}
                    className={`hover:bg-gray-50 ${status !== 'active' ? 'opacity-60' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {magazine.cover_image_url ? (
                          <img
                            src={magazine.cover_image_url}
                            alt={magazine.title}
                            className="h-12 w-9 object-cover rounded mr-3 flex-shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-9 bg-gray-100 rounded mr-3 flex-shrink-0 flex items-center justify-center">
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {magazine.title}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {getPublisherName(magazine)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {magazine.fulfillment_method === 'neesh_handled'
                          ? 'On Demand'
                          : magazine.inventory_count !== null
                          ? magazine.inventory_count.toLocaleString()
                          : '0'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <span className="text-gray-700">
                          ${magazine.wholesale_price?.toFixed(2) || '—'}
                        </span>
                        {magazine.price && (
                          <span className="text-gray-400 ml-1 text-xs">
                            / ${magazine.price.toFixed(2)} retail
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {status === 'suspended' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                          <Ban className="h-3 w-3" />
                          Suspended
                        </span>
                      ) : status === 'archived' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500 flex items-center gap-1 w-fit">
                          <Archive className="h-3 w-3" />
                          Archived
                        </span>
                      ) : isOutOfStock ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                          <TrendingDown className="h-3 w-3" />
                          Low Stock
                        </span>
                      ) : magazine.fulfillment_method === 'neesh_handled' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          On Demand
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuId(actionMenuId === magazine.id ? null : magazine.id);
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {actionMenuId === magazine.id && (
                          <div
                            className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                setSelectedMagazine(magazine);
                                setActionMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="h-4 w-4" />
                              View Details
                            </button>
                            <button
                              onClick={() => {
                                navigate(`/publisher/titles/${magazine.id}/edit`);
                                setActionMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit Magazine
                            </button>
                            <button
                              onClick={() => {
                                navigate(`/admin/publishers/${magazine.publisher_id}`);
                                setActionMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View Publisher
                            </button>

                            <div className="border-t border-gray-100 my-1" />

                            {status === 'active' && (
                              <>
                                <button
                                  onClick={() => {
                                    setConfirmAction({
                                      magazineId: magazine.id,
                                      title: magazine.title,
                                      action: 'suspend',
                                    });
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
                                >
                                  <Ban className="h-4 w-4" />
                                  Suspend
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmAction({
                                      magazineId: magazine.id,
                                      title: magazine.title,
                                      action: 'archive',
                                    });
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive
                                </button>
                              </>
                            )}
                            {status === 'suspended' && (
                              <>
                                <button
                                  onClick={() => {
                                    setConfirmAction({
                                      magazineId: magazine.id,
                                      title: magazine.title,
                                      action: 'reactivate',
                                    });
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Reactivate
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmAction({
                                      magazineId: magazine.id,
                                      title: magazine.title,
                                      action: 'archive',
                                    });
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive
                                </button>
                              </>
                            )}
                            {status === 'archived' && (
                              <>
                                <button
                                  onClick={() => {
                                    setConfirmAction({
                                      magazineId: magazine.id,
                                      title: magazine.title,
                                      action: 'reactivate',
                                    });
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Reactivate
                                </button>
                                <button
                                  onClick={() => {
                                    setConfirmAction({
                                      magazineId: magazine.id,
                                      title: magazine.title,
                                      action: 'suspend',
                                    });
                                    setActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
                                >
                                  <Ban className="h-4 w-4" />
                                  Suspend
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Magazine Detail Modal */}
      {selectedMagazine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedMagazine(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex gap-6">
                {selectedMagazine.cover_image_url ? (
                  <img
                    src={selectedMagazine.cover_image_url}
                    alt={selectedMagazine.title}
                    className="w-40 h-56 object-cover rounded-lg shadow-md flex-shrink-0"
                  />
                ) : (
                  <div className="w-40 h-56 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Package className="h-10 w-10 text-gray-300" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-bold text-gray-900">{selectedMagazine.title}</h2>
                    {(() => {
                      const status = getMagazineStatus(selectedMagazine.is_active);
                      if (status === 'suspended') return (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 flex-shrink-0">Suspended</span>
                      );
                      if (status === 'archived') return (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500 flex-shrink-0">Archived</span>
                      );
                      return null;
                    })()}
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    {getPublisherName(selectedMagazine)}
                  </p>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Retail Price</span>
                      <p className="font-medium">${selectedMagazine.price?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Wholesale Price</span>
                      <p className="font-medium">${selectedMagazine.wholesale_price?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Inventory</span>
                      <p className="font-medium">
                        {selectedMagazine.fulfillment_method === 'neesh_handled'
                          ? 'On Demand'
                          : selectedMagazine.inventory_count?.toLocaleString() || '0'}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Min. Order</span>
                      <p className="font-medium">{selectedMagazine.minimum_order_quantity || 1}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Fulfillment</span>
                      <p className="font-medium">
                        {selectedMagazine.fulfillment_method === 'neesh_handled' ? 'Neesh' : 'Publisher'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {selectedMagazine.description && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                  <p className="text-sm text-gray-700">{selectedMagazine.description}</p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                {(() => {
                  const status = getMagazineStatus(selectedMagazine.is_active);
                  return (
                    <>
                      {status === 'active' && (
                        <button
                          onClick={() => {
                            setConfirmAction({
                              magazineId: selectedMagazine.id,
                              title: selectedMagazine.title,
                              action: 'suspend',
                            });
                          }}
                          className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                        >
                          Suspend
                        </button>
                      )}
                      {status === 'active' && (
                        <button
                          onClick={() => {
                            setConfirmAction({
                              magazineId: selectedMagazine.id,
                              title: selectedMagazine.title,
                              action: 'archive',
                            });
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                        >
                          Archive
                        </button>
                      )}
                      {(status === 'suspended' || status === 'archived') && (
                        <button
                          onClick={() => {
                            setConfirmAction({
                              magazineId: selectedMagazine.id,
                              title: selectedMagazine.title,
                              action: 'reactivate',
                            });
                          }}
                          className="px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
                        >
                          Reactivate
                        </button>
                      )}
                      {status === 'archived' && (
                        <button
                          onClick={() => {
                            setConfirmAction({
                              magazineId: selectedMagazine.id,
                              title: selectedMagazine.title,
                              action: 'suspend',
                            });
                          }}
                          className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                        >
                          Suspend
                        </button>
                      )}
                      {status === 'suspended' && (
                        <button
                          onClick={() => {
                            setConfirmAction({
                              magazineId: selectedMagazine.id,
                              title: selectedMagazine.title,
                              action: 'archive',
                            });
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                        >
                          Archive
                        </button>
                      )}
                      <button
                        onClick={() => navigate(`/publisher/titles/${selectedMagazine.id}/edit`)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => navigate(`/admin/publishers/${selectedMagazine.publisher_id}`)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      >
                        View Publisher
                      </button>
                      <button
                        onClick={() => setSelectedMagazine(null)}
                        className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
                      >
                        Close
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {confirmAction.action === 'suspend' && 'Suspend Magazine'}
                {confirmAction.action === 'archive' && 'Archive Magazine'}
                {confirmAction.action === 'reactivate' && 'Reactivate Magazine'}
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                {confirmAction.action === 'suspend' && (
                  <>Are you sure you want to suspend <strong>{confirmAction.title}</strong>? It will be hidden from the retailer catalogue but can be reactivated later.</>
                )}
                {confirmAction.action === 'archive' && (
                  <>Are you sure you want to archive <strong>{confirmAction.title}</strong>? It will be hidden from the catalogue. You can reactivate it later.</>
                )}
                {confirmAction.action === 'reactivate' && (
                  <>Reactivate <strong>{confirmAction.title}</strong>? It will become visible in the retailer catalogue again.</>
                )}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const newIsActive =
                      confirmAction.action === 'reactivate' ? true :
                      confirmAction.action === 'archive' ? false :
                      null; // suspend
                    updateMagazineStatus(confirmAction.magazineId, newIsActive);
                  }}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                    confirmAction.action === 'reactivate'
                      ? 'bg-green-600 hover:bg-green-700'
                      : confirmAction.action === 'suspend'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {confirmAction.action === 'suspend' && 'Suspend'}
                  {confirmAction.action === 'archive' && 'Archive'}
                  {confirmAction.action === 'reactivate' && 'Reactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
