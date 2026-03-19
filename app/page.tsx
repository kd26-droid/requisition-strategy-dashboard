"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from "@/components/ui/tooltip"
import { SettingsPanel, AppSettings, buildDefaultSettings } from "@/components/settings-dialog"
import { AutoAssignUsersPopover, AutoAssignActionsPopover } from "@/components/autoassign-popovers"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  Settings,
  Users,
  CheckSquare,
  Download,
  Eye,
  EyeOff,
  Search,
  ArrowUpDown,
  GripVertical,
  ChevronDown,
} from "lucide-react"
import { getRequisitionIds, getRequisitionItems, type RequisitionItem } from "@/lib/api"

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMN_LABELS: Record<string, string> = {
  itemName:    "Item Name",
  itemCode:    "Item Code",
  erpCode:     "ERP Code",
  mpn:         "MPN",
  cpn:         "CPN",
  hsn:         "HSN",
  quantity:    "Qty",
  unit:        "Unit",
  desiredPrice:"Desired Price",
  tags:        "Tags",
  specs:       "Specifications",
  requisitionId: "Requisition ID",
  rfqAssignee: "RFQ Assignee",
  quoteAssignee:"Quote Assignee",
  action:      "Action",
}

const DEFAULT_COLUMN_ORDER = [
  "itemName", "itemCode", "erpCode", "mpn", "cpn", "hsn",
  "quantity", "unit", "desiredPrice", "tags", "specs", "requisitionId",
  "rfqAssignee", "quoteAssignee", "action",
]

const DEFAULT_WIDTHS: Record<string, number> = {
  itemName: 180, itemCode: 120, erpCode: 110, mpn: 110, cpn: 110, hsn: 90,
  quantity: 80, unit: 80, desiredPrice: 120, tags: 140, specs: 200,
  requisitionId: 140, rfqAssignee: 140, quoteAssignee: 140, action: 120,
}

// ─── Row type ─────────────────────────────────────────────────────────────────

interface RowItem {
  _id: string // requisition_item_id
  _requisitionId: string
  itemName: string
  itemCode: string
  erpCode: string
  mpn: string
  cpn: string
  hsn: string
  quantity: string
  unit: string
  desiredPrice: string
  tags: string
  specs: string
  requisitionId: string
  rfqAssigneeName: string
  quoteAssigneeName: string
  action: string
}

function mapItem(raw: RequisitionItem): RowItem {
  const info = raw.item_information || ({} as any)
  const attrs = (raw.attributes || [])
    .map(a => {
      const val = a.attribute_values?.[0]
      if (!val) return null
      const unit = val.measurement_unit?.measurement_unit_abbreviation || ""
      return `${a.attribute_name}: ${val.value}${unit ? " " + unit : ""}`
    })
    .filter(Boolean)
    .join(", ")

  const price = raw.pricing_information?.desired_price
  const currency = raw.pricing_information?.currency_symbol || ""
  const priceStr = price != null ? `${currency}${price}` : ""

  return {
    _id: raw.requisition_item_id,
    _requisitionId: raw.requisition,
    itemName:    info.item_name || "",
    itemCode:    info.item_code || "",
    erpCode:     info.ERP_item_code || "",
    mpn:         info.MPN_item_code || "",
    cpn:         info.CPN_item_code || "",
    hsn:         info.HSN_item_code || "",
    quantity:    raw.quantity || "",
    unit:        raw.measurement_unit_details?.measurement_unit_abbreviation || "",
    desiredPrice: priceStr,
    tags:        (raw.tags || []).join(", "),
    specs:       attrs,
    requisitionId: raw.custom_requisition_id || raw.requisition || "",
    rfqAssigneeName: "",
    quoteAssigneeName: "",
    action: "",
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RequisitionStrategyPage() {
  const { toast } = useToast()

  // data
  const [lineItems, setLineItems] = useState<RowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // selection
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  // search
  const [searchTerm, setSearchTerm] = useState("")

  // sort
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)

  // columns
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER)
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(DEFAULT_WIDTHS)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizeColumn, setResizeColumn] = useState<string | null>(null)
  const isResizing = useRef(false)

  // settings
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<"users" | "prices" | "actions">("users")
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const profiles = JSON.parse(localStorage.getItem("appSettingsProfiles") || "{}")
        const profileName = localStorage.getItem("currentSettingsProfile") || "default"
        if (profiles[profileName]) return profiles[profileName]
      } catch {}
    }
    return buildDefaultSettings("default")
  })

  // popovers
  const [showAssignUsersPopup, setShowAssignUsersPopup] = useState(false)
  const [showAssignActionsPopup, setShowAssignActionsPopup] = useState(false)

  // column visibility dropdown
  const [colDropdownOpen, setColDropdownOpen] = useState(false)
  const colDropdownRef = useRef<HTMLDivElement>(null)

  // ── Detect requisition mode & back ─────────────────────────────────────────

  const isRequisitionMode = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).has("requisition_ids")
    : false

  const handleBackClick = () => {
    if (isRequisitionMode) {
      window.parent.postMessage({ type: "REQUISITION_STRATEGY_CLOSE" }, "*")
      return
    }
    window.history.back()
  }

  // ── Load items ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const ids = getRequisitionIds()
    if (!ids.length) {
      setLoading(false)
      setError("No requisition IDs provided.")
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    getRequisitionItems(ids, { itemsPerPage: 500 })
      .then(res => {
        if (cancelled) return
        setLineItems((res.data || []).map(mapItem))
      })
      .catch(err => {
        if (cancelled) return
        setError(err.message || "Failed to load items.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  // ── Column resize ───────────────────────────────────────────────────────────

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizeColumn) return
      const th = document.querySelector(`th[data-col="${resizeColumn}"]`)
      if (!th) return
      const rect = th.getBoundingClientRect()
      const newWidth = Math.max(60, e.clientX - rect.left)
      setColumnWidths(prev => ({ ...prev, [resizeColumn]: newWidth }))
    }
    const onMouseUp = () => {
      setResizeColumn(null)
      isResizing.current = false
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [resizeColumn])

  // ── Close column dropdown on outside click ──────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colDropdownRef.current && !colDropdownRef.current.contains(e.target as Node)) {
        setColDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // ── Derived data ────────────────────────────────────────────────────────────

  const allTags = useMemo(() => {
    const set = new Set<string>()
    lineItems.forEach(it => it.tags.split(",").map(t => t.trim()).filter(Boolean).forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [lineItems])

  const filteredAndSorted = useMemo(() => {
    let items = lineItems
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      items = items.filter(it =>
        it.itemName.toLowerCase().includes(q) ||
        it.itemCode.toLowerCase().includes(q) ||
        it.erpCode.toLowerCase().includes(q) ||
        it.mpn.toLowerCase().includes(q) ||
        it.cpn.toLowerCase().includes(q) ||
        it.tags.toLowerCase().includes(q) ||
        it.requisitionId.toLowerCase().includes(q)
      )
    }
    if (sortKey) {
      items = [...items].sort((a, b) => {
        const av = (a as any)[sortKey] || ""
        const bv = (b as any)[sortKey] || ""
        return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
      })
    }
    return items
  }, [lineItems, searchTerm, sortKey, sortAsc])

  const visibleColumns = columnOrder.filter(c => !hiddenColumns.includes(c))

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(true) }
  }

  const handleSelectAll = () => {
    if (selectedItems.length === filteredAndSorted.length) setSelectedItems([])
    else setSelectedItems(filteredAndSorted.map(i => i._id))
  }

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const handleColumnDrag = (from: string, to: string) => {
    setColumnOrder(prev => {
      const arr = [...prev]
      const fi = arr.indexOf(from)
      const ti = arr.indexOf(to)
      arr.splice(fi, 1)
      arr.splice(ti, 0, from)
      return arr
    })
  }

  const toggleColumn = (key: string) => {
    setHiddenColumns(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key])
  }

  const handleExportCSV = () => {
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const headers = visibleColumns.map(c => COLUMN_LABELS[c] || c)
    const rows = filteredAndSorted.map(item =>
      visibleColumns.map(c => escape((item as any)[c] || "")).join(",")
    )
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `requisition_strategy_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAutoAssignUsers = (scope: "all" | "unassigned" | "selected") => {
    const rfqMap = currentSettings.users?.rfqAssigneeMap || {}
    const quoteMap = currentSettings.users?.quoteAssigneeMap || {}

    const targets = scope === "all"
      ? filteredAndSorted
      : scope === "unassigned"
        ? filteredAndSorted.filter(i => !i.rfqAssigneeName && !i.quoteAssigneeName)
        : filteredAndSorted.filter(i => selectedItems.includes(i._id))

    let updated = 0
    setLineItems(prev => prev.map(item => {
      if (!targets.find(t => t._id === item._id)) return item
      const itemTags = item.tags.split(",").map(t => t.trim()).filter(Boolean)
      const rfqUsers = new Set<string>()
      itemTags.forEach(tag => { (rfqMap[tag] || []).forEach((u: string) => rfqUsers.add(u)) })
      const newRfq = Array.from(rfqUsers).join("; ")
      const newQuote = item.quoteAssigneeName // quote assign logic TBD with customer mapping
      if (newRfq !== item.rfqAssigneeName) updated++
      return { ...item, rfqAssigneeName: newRfq || item.rfqAssigneeName, quoteAssigneeName: newQuote }
    }))

    toast({ title: "Auto-assigned users", description: `Updated ${updated} item(s)` })
  }

  const handleAssignActions = (scope: "all" | "non-selected" | "selected") => {
    // Action assignment logic — placeholder for now
    toast({ title: "Assign Actions", description: "Action assignment coming soon." })
  }

  const saveSettings = (s: AppSettings) => {
    setCurrentSettings(s)
    const profiles = JSON.parse(localStorage.getItem("appSettingsProfiles") || "{}")
    profiles[s.name] = s
    localStorage.setItem("appSettingsProfiles", JSON.stringify(profiles))
    localStorage.setItem("currentSettingsProfile", s.name)
    setSettingsOpen(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar — Back + Settings */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 py-3 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleBackClick} className="flex items-center gap-2 hover:bg-gray-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {isRequisitionMode ? "Back to Inbound Dashboard" : "Back"}
          </Button>

          <h1 className="text-lg font-semibold text-gray-900">Requisition Strategy</h1>

          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)} className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="bg-white rounded-lg shadow-sm p-4">

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Left: action buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" className="flex items-center gap-2 bg-transparent" onClick={() => setShowAssignUsersPopup(true)}>
                <Users className="h-4 w-4" />
                Auto Assign Users
              </Button>

              <Button variant="outline" className="flex items-center gap-2 bg-transparent" onClick={() => setShowAssignActionsPopup(true)}>
                <CheckSquare className="h-4 w-4" />
                Assign Actions
              </Button>

              <Button variant="outline" className="flex items-center gap-2 bg-transparent" onClick={handleExportCSV}>
                <Download className="h-4 w-4" />
                Download {filteredAndSorted.length > 0 ? `(${filteredAndSorted.length})` : ""}
              </Button>
            </div>

            {/* Right: search + columns */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56"
                />
              </div>

              {/* Column visibility */}
              <div className="relative" ref={colDropdownRef}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 bg-transparent"
                  title="Show/Hide Columns"
                  onClick={() => setColDropdownOpen(p => !p)}
                >
                  <Eye className="h-3 w-3 text-gray-600" />
                </Button>
                {colDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    <div className="p-2 space-y-1">
                      {columnOrder.map(key => (
                        <div
                          key={key}
                          className="flex items-center space-x-2 p-1 rounded cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleColumn(key)}
                        >
                          {hiddenColumns.includes(key)
                            ? <EyeOff className="h-3 w-3 text-gray-400" />
                            : <Eye className="h-3 w-3 text-blue-600" />
                          }
                          <span className={`text-xs ${hiddenColumns.includes(key) ? "text-gray-400" : "text-gray-900"}`}>
                            {COLUMN_LABELS[key]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary line */}
          <div className="text-xs text-gray-500 mb-3">
            {loading ? "Loading..." : `${filteredAndSorted.length} item${filteredAndSorted.length !== 1 ? "s" : ""}${selectedItems.length > 0 ? ` · ${selectedItems.length} selected` : ""}`}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
          )}

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)]" style={{ position: "relative" }}>
            <style>{`
              .rtbl td, .rtbl th { box-sizing: border-box; }
              .rtbl td > div, .rtbl td > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
              .pin { position: sticky !important; }
              .pin-edge { box-shadow: 4px 0 6px -2px rgba(0,0,0,0.15); }
            `}</style>
            <table className="border-collapse rtbl" style={{ minWidth: "100%" }}>
              <thead className="sticky top-0 z-30">
                <tr>
                  {/* Checkbox col */}
                  <th className="pin p-2 text-left bg-gray-50 border-b border-gray-200 z-40" style={{ width: 40, minWidth: 40, maxWidth: 40, left: 0 }}>
                    <input
                      type="checkbox"
                      checked={selectedItems.length === filteredAndSorted.length && filteredAndSorted.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  {visibleColumns.map((col, idx) => {
                    const isSticky = idx === 0 || idx === 1
                    const isLastSticky = idx === 1
                    const col0W = columnWidths[visibleColumns[0]] || 130
                    const left = idx === 0 ? 40 : idx === 1 ? 40 + col0W : 0
                    const w = columnWidths[col] || 120
                    return (
                      <th
                        key={col}
                        data-col={col}
                        className={`p-2 font-medium text-gray-700 text-xs relative group whitespace-nowrap select-none bg-gray-50 border-b border-gray-200 text-left ${isSticky ? "pin z-40" : ""} ${isLastSticky ? "pin-edge" : ""}`}
                        style={{ width: w, minWidth: w, maxWidth: w, ...(isSticky ? { left } : {}) }}
                        draggable
                        onDragStart={e => { if (isResizing.current) { e.preventDefault(); return } setDraggedColumn(col) }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => { if (draggedColumn && draggedColumn !== col) handleColumnDrag(draggedColumn, col); setDraggedColumn(null) }}
                      >
                        <div className="flex items-center justify-between w-full">
                          <button onClick={() => handleSort(col)} className="flex items-center gap-1 hover:text-gray-900">
                            {COLUMN_LABELS[col]}
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                          <GripVertical className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0 ml-2" />
                        </div>
                        <div
                          className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize hover:bg-blue-400/40"
                          onMouseDown={e => { e.preventDefault(); isResizing.current = true; setResizeColumn(col) }}
                          style={{ zIndex: 10 }}
                        />
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="p-8 text-center text-sm text-gray-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                        Loading items...
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && filteredAndSorted.length === 0 && !error && (
                  <tr>
                    <td colSpan={visibleColumns.length + 1} className="p-8 text-center text-sm text-gray-400">
                      No items found.
                    </td>
                  </tr>
                )}
                {!loading && filteredAndSorted.map(item => (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors group/row">
                    <td className="pin p-2 z-10 bg-white group-hover/row:bg-gray-50" style={{ width: 40, minWidth: 40, maxWidth: 40, left: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item._id)}
                        onChange={() => handleSelectItem(item._id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    {visibleColumns.map((col, idx) => {
                      const isSticky = idx === 0 || idx === 1
                      const isLastSticky = idx === 1
                      const col0W = columnWidths[visibleColumns[0]] || 130
                      const left = idx === 0 ? 40 : idx === 1 ? 40 + col0W : 0
                      const w = columnWidths[col] || 120
                      const stickyClass = isSticky
                        ? `pin z-10 bg-white group-hover/row:bg-gray-50${isLastSticky ? " pin-edge" : ""}`
                        : ""
                      const style: React.CSSProperties = { width: w, minWidth: w, maxWidth: w, ...(isSticky ? { left } : {}) }
                      const value = (item as any)[col] || ""

                      // Tags — render as badges
                      if (col === "tags") {
                        const tagList = value.split(",").map((t: string) => t.trim()).filter(Boolean)
                        return (
                          <td key={col} className={`p-2 ${stickyClass}`} style={style}>
                            <div className="flex flex-wrap gap-1">
                              {tagList.map((t: string) => (
                                <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-100">{t}</span>
                              ))}
                            </div>
                          </td>
                        )
                      }

                      // Specs — tooltip on truncate
                      if (col === "specs") {
                        return (
                          <td key={col} className={`p-2 ${stickyClass}`} style={style}>
                            <UiTooltip>
                              <UiTooltipTrigger asChild>
                                <span className="text-xs text-gray-700 truncate block cursor-help">{value}</span>
                              </UiTooltipTrigger>
                              {value && <UiTooltipContent><p className="max-w-xs text-xs whitespace-pre-wrap">{value}</p></UiTooltipContent>}
                            </UiTooltip>
                          </td>
                        )
                      }

                      // Item Name — bold
                      if (col === "itemName") {
                        return (
                          <td key={col} className={`p-2 ${stickyClass}`} style={style}>
                            <span className="font-medium text-gray-900 text-xs truncate block" title={value}>{value}</span>
                          </td>
                        )
                      }

                      // Code columns — monospace pill
                      if (["itemCode", "erpCode", "mpn", "cpn", "hsn"].includes(col)) {
                        return (
                          <td key={col} className={`p-2 ${stickyClass}`} style={style}>
                            {value ? (
                              <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1 py-0.5 rounded" title={value}>{value}</span>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                        )
                      }

                      // Assignee columns
                      if (col === "rfqAssignee" || col === "quoteAssignee") {
                        const assigneeName = col === "rfqAssignee" ? item.rfqAssigneeName : item.quoteAssigneeName
                        return (
                          <td key={col} className={`p-2 ${stickyClass}`} style={style}>
                            {assigneeName
                              ? <span className="text-xs text-gray-800 truncate block" title={assigneeName}>{assigneeName}</span>
                              : <span className="text-xs text-gray-300">Unassigned</span>
                            }
                          </td>
                        )
                      }

                      // Default cell
                      return (
                        <td key={col} className={`p-2 ${stickyClass}`} style={style}>
                          <span className="text-xs text-gray-700 truncate block" title={value}>{value || <span className="text-gray-300">—</span>}</span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Popovers */}
      <AutoAssignUsersPopover
        open={showAssignUsersPopup}
        onOpenChange={setShowAssignUsersPopup}
        selectedItemsCount={selectedItems.length}
        currentSettings={currentSettings}
        onExecute={handleAutoAssignUsers}
        onOpenSettings={() => { setSettingsInitialTab("users"); setSettingsOpen(true) }}
      />

      <AutoAssignActionsPopover
        open={showAssignActionsPopup}
        onOpenChange={setShowAssignActionsPopup}
        selectedItemsCount={selectedItems.length}
        currentSettings={currentSettings}
        onExecute={handleAssignActions}
        onOpenSettings={() => { setSettingsInitialTab("actions"); setSettingsOpen(true) }}
      />

      {/* Settings overlay */}
      {settingsOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setSettingsOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <SettingsPanel
              initialSettings={currentSettings}
              initialTab={settingsInitialTab}
              allTags={allTags}
              allCustomers={[]}
              availableUsers={[]}
              rfqResponsibleUsers={[]}
              quoteResponsibleUsers={[]}
              onSave={saveSettings}
              onCancel={() => setSettingsOpen(false)}
            />
          </div>
        </div>
      )}

      <Toaster />
    </div>
  )
}
