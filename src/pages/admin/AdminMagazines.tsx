import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { Package, AlertTriangle, TrendingDown } from "lucide-react";


interface Magazine {
  id: string;
  title: string;
  cover_image_url: string | null;
  inventory_count: number | null;
  minimum_order_quantity: number | null;
  fulfillment_method: 'publisher_handled' | 'neesh_handled';
  publisher: {
    company_name: string;
  };
}

export function AdminMagazines() {
  const [magazines, setMagazines] = useState<Magazine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  const fetchMagazines = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('magazines')
        .select(`
          id,
          title,
          cover_image_url,
          inventory_count,
          minimum_order_quantity,
          fulfillment_method,
          publisher:publishers(company_name)
        `)
        .eq('is_active', true)
        .order('title');

      // Apply filters
      if (filter === 'out_of_stock') {
        query = query.lte('inventory_count', 0);
      } else if (filter === 'low_stock') {
        query = query.gt('inventory_count', 0).lte('inventory_count', 10);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMagazines(data as unknown as Magazine[] || []);
    } catch (error) {
      console.error('Error fetching magazines:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchMagazines();
  }, [fetchMagazines]);

  const lowStockCount = magazines.filter(
    (m) => m.fulfillment_method === 'publisher_handled' && m.inventory_count !== null && m.inventory_count > 0 && m.inventory_count <= 10
  ).length;

  const outOfStockCount = magazines.filter(
    (m) => m.fulfillment_method === 'publisher_handled' && (m.inventory_count === null || m.inventory_count <= 0)
  ).length;

  return (
    <AdminLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Magazine Inventory</h1>
        <p className="text-gray-600 mt-2">Monitor inventory levels across all publishers</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Magazines</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {magazines.length}
              </p>
            </div>
            <Package className="h-10 w-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Low Stock</p>
              <p className="text-2xl font-semibold text-amber-600 mt-1">
                {lowStockCount}
              </p>
            </div>
            <TrendingDown className="h-10 w-10 text-amber-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Out of Stock</p>
              <p className="text-2xl font-semibold text-red-600 mt-1">
                {outOfStockCount}
              </p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Magazines
        </button>
        <button
          onClick={() => setFilter('low_stock')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            filter === 'low_stock'
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Low Stock ({lowStockCount})
        </button>
        <button
          onClick={() => setFilter('out_of_stock')}
          className={`px-4 py-2 rounded-md font-medium transition-colors ${
            filter === 'out_of_stock'
              ? 'bg-red-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Out of Stock ({outOfStockCount})
        </button>
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
                Fulfillment
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Inventory
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Min. Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
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
            ) : magazines.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No magazines found
                </td>
              </tr>
            ) : (
              magazines.map((magazine) => {
                const isLowStock =
                  magazine.fulfillment_method === 'publisher_handled' &&
                  magazine.inventory_count !== null &&
                  magazine.inventory_count > 0 &&
                  magazine.inventory_count <= 10;
                const isOutOfStock =
                  magazine.fulfillment_method === 'publisher_handled' &&
                  (magazine.inventory_count === null || magazine.inventory_count <= 0);

                return (
                  <tr key={magazine.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {magazine.cover_image_url && (
                          <img
                            src={magazine.cover_image_url}
                            alt={magazine.title}
                            className="h-12 w-9 object-cover rounded mr-3"
                          />
                        )}
                        <div className="text-sm font-medium text-gray-900">
                          {magazine.title}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {Array.isArray(magazine.publisher) 
                          ? magazine.publisher[0]?.company_name 
                          : magazine.publisher?.company_name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          magazine.fulfillment_method === 'neesh_handled'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {magazine.fulfillment_method === 'neesh_handled'
                          ? 'Neesh'
                          : 'Publisher'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {magazine.fulfillment_method === 'neesh_handled'
                          ? 'N/A'
                          : magazine.inventory_count !== null
                          ? magazine.inventory_count.toLocaleString()
                          : '0'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {magazine.minimum_order_quantity || 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {magazine.fulfillment_method === 'neesh_handled' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          On Demand
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
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          In Stock
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
