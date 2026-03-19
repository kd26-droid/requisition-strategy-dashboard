"use client"

/**
 * Wrapper component that fetches real data from Factwise API
 * and passes it to the existing dashboard
 */

import { useState, useEffect } from 'react'
import {
  getProjectId,
  getAuthToken,
  getProjectOverview,
  getProjectItems,
  getProjectUsers,
  getVendors,
  getCategories,
  updateProjectItem,
  bulkAssignUsers,
  notifyItemUpdated,
  notifyItemsAssigned,
  sendMessageToFactwise,
  type ProjectItem,
  type ProjectUser,
  type Vendor,
  type Category,
} from '@/lib/api'

// Import the original dashboard (we'll rename the current page.tsx)
// For now, just show loading/error states

export default function DashboardWrapper() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // Data from API
  const [projectData, setProjectData] = useState<any>(null)
  const [items, setItems] = useState<ProjectItem[]>([])
  const [users, setUsers] = useState<ProjectUser[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        // Get project ID and token from URL
        const pid = getProjectId()
        const tok = getAuthToken()

        if (!pid) {
          throw new Error('No project_id in URL. Please open this dashboard from Factwise.')
        }

        if (!tok) {
          throw new Error('No authentication token in URL. Please open this dashboard from Factwise.')
        }

        setProjectId(pid)
        setToken(tok)

        console.log('[Dashboard] Loading data for project:', pid)

        // Fetch all data in parallel
        const [overviewData, itemsData, usersData, vendorsData, categoriesData] = await Promise.all([
          getProjectOverview(pid),
          getProjectItems(pid),
          getProjectUsers(pid),
          getVendors(pid),
          getCategories(pid),
        ])

        console.log('[Dashboard] Data loaded successfully:', {
          project: overviewData.project.project_name,
          items: itemsData.items.length,
          users: usersData.users.length,
          vendors: vendorsData.vendors.length,
          categories: categoriesData.categories.length,
        })

        setProjectData(overviewData)
        setItems(itemsData.items)
        setUsers(usersData.users)
        setVendors(vendorsData.vendors)
        setCategories(categoriesData.categories)

        // Notify Factwise that dashboard is ready
        sendMessageToFactwise({ type: 'DASHBOARD_READY' })

        setLoading(false)
      } catch (err: any) {
        console.error('[Dashboard] Error loading data:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Handle item update
  const handleUpdateItem = async (itemId: string, updates: { rate?: number; quantity?: number; notes?: string; custom_fields?: any }) => {
    if (!projectId) return

    try {
      console.log('[Dashboard] Updating item:', itemId, updates)

      const result = await updateProjectItem(projectId, itemId, updates)

      console.log('[Dashboard] Item updated successfully:', result.message)

      // Update local state
      setItems(prevItems =>
        prevItems.map(item =>
          item.project_item_id === itemId
            ? { ...item, ...updates, amount: updates.rate && updates.quantity ? updates.rate * updates.quantity : item.amount }
            : item
        )
      )

      // Notify Factwise
      notifyItemUpdated(itemId, updates)

      return result
    } catch (err: any) {
      console.error('[Dashboard] Error updating item:', err)
      throw err
    }
  }

  // Handle user assignment
  const handleAssignUsers = async (itemIds: string[], userIds: string[]) => {
    if (!projectId) return

    try {
      console.log('[Dashboard] Assigning users:', { itemIds, userIds })

      const assignments = itemIds.map(itemId => ({
        project_item_id: itemId,
        user_ids: userIds,
        action: 'replace' as const,
      }))

      const result = await bulkAssignUsers(projectId, assignments)

      console.log('[Dashboard] Users assigned:', result.updated, 'items')

      // Update local state
      const assignedUsers = users.filter(u => userIds.includes(u.user_id))
      setItems(prevItems =>
        prevItems.map(item =>
          itemIds.includes(item.project_item_id)
            ? { ...item, assigned_users: assignedUsers, assigned_users_count: assignedUsers.length }
            : item
        )
      )

      // Notify Factwise
      notifyItemsAssigned(itemIds, userIds)

      return result
    } catch (err: any) {
      console.error('[Dashboard] Error assigning users:', err)
      throw err
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <div className="text-xl font-semibold text-slate-700 dark:text-slate-300">
            Loading Strategy Dashboard...
          </div>
          <div className="text-sm text-slate-500">
            Fetching project data from Factwise
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl p-8 space-y-4">
          <div className="flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full mx-auto">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-slate-100">
            Failed to Load Dashboard
          </h2>
          <p className="text-center text-slate-600 dark:text-slate-400">
            {error}
          </p>
          <div className="pt-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
          <div className="pt-2 text-xs text-center text-slate-500 dark:text-slate-400 space-y-1">
            <div>Make sure you opened this from Factwise</div>
            <div>URL should have ?project_id=...&token=...</div>
          </div>
        </div>
      </div>
    )
  }

  // Success - show data summary for now
  // TODO: Pass this data to the actual dashboard component
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            {projectData.project.project_name}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Project Code: {projectData.project.project_code}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500">
            Status: {projectData.project.status}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 dark:text-slate-400">Total Items</div>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {projectData.summary.total_items}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 dark:text-slate-400">With Users</div>
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {projectData.summary.items_with_assigned_users}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 dark:text-slate-400">Total Amount</div>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              ₹{projectData.summary.total_amount.toLocaleString()}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <div className="text-sm text-slate-600 dark:text-slate-400">Avg Rate</div>
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
              ₹{projectData.summary.average_rate.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Project Items ({items.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Item Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Assigned To
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {items.slice(0, 10).map((item) => (
                  <tr key={item.project_item_id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.item_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      {item.item_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {item.quantity} {item.measurement_unit?.abbreviation}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                      {item.currency?.symbol}{item.rate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                      {item.currency?.symbol}{item.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                      {item.assigned_users.map(u => u.name).join(', ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items.length > 10 && (
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 text-center text-sm text-slate-600 dark:text-slate-400">
              Showing 10 of {items.length} items
            </div>
          )}
        </div>

        {/* Test Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 space-y-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Test API Functions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={async () => {
                if (items.length > 0) {
                  const testItem = items[0]
                  await handleUpdateItem(testItem.project_item_id, {
                    rate: Math.random() * 1000 + 500,
                    quantity: Math.floor(Math.random() * 100) + 10,
                  })
                  alert('Item updated! Check console for details.')
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Test Update First Item
            </button>
            <button
              onClick={async () => {
                if (items.length > 0 && users.length > 0) {
                  const testItem = items[0]
                  const testUser = users[0]
                  await handleAssignUsers([testItem.project_item_id], [testUser.user_id])
                  alert('User assigned! Check console for details.')
                }
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              Test Assign User to First Item
            </button>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Open browser console to see API calls and PostMessage communication
          </div>
        </div>

        {/* Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Users ({users.length})</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              {users.slice(0, 5).map(u => (
                <li key={u.user_id}>{u.name} - {u.role}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Vendors ({vendors.length})</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              {vendors.slice(0, 5).map(v => (
                <li key={v.vendor_id}>{v.vendor_name}</li>
              ))}
            </ul>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">Categories ({categories.length})</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              {categories.slice(0, 5).map(c => (
                <li key={c.category_id}>{c.category_name} ({c.item_count})</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
