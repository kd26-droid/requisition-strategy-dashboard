'use client'

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search,
  Trash2,
  Plus,
  Settings2,
  DollarSign,
  CheckSquare,
  Link2,
  Building2,
  Globe,
  Filter,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

// --- TYPE DEFINITIONS ---
export type MappingId =
  | 'Direct - Materials'
  | 'Indirect - Materials'
  | 'Direct - Capex'
  | 'Indirect - Capex'

export type PriceSource =
  | 'PO'
  | 'Contract'
  | 'Quote'
  | 'Online - Digikey'
  | 'Online - Mouser'
  | 'Online - LCSC'
  | 'Online - Farnell'
  | 'EXIM'

export type ActionPurpose = 'Quote' | 'PO' | 'Contract'
export type ItemIdType = 'HSN' | 'MPN' | 'CPN'

export type UsersSettings = {
  rfqAssigneeMap: Record<string, string[]>
  quoteAssigneeMap: Record<string, string[]>
}

export type PricesSettings = {
  mappingItemId: Record<MappingId, string>
  itemIdOptions: string[]
  sourcesByMapping: Record<MappingId, PriceSource[]>
}

export type ActionRule = {
  id: string
  criteria: ActionCriterion[]
  assignAction: string
}

export type ActionsSettings = {
  purpose: ActionPurpose
  itemIdType: ItemIdType
  sources: PriceSource[]
  maxAgeDays: number
  criteria?: ActionCriterion[]       // legacy — kept for backward compat
  formulas?: ActionRule[]            // new multi-rule format
}

export type AppSettings = {
  name: string
  users: UsersSettings
  prices: PricesSettings
  actions: ActionsSettings
}

// --- CONSTANTS ---
const DEFAULT_MAPPING_IDS: MappingId[] = [
  'Direct - Materials',
  'Indirect - Materials',
  'Direct - Capex',
  'Indirect - Capex',
]

const DEFAULT_PRICE_SOURCES: PriceSource[] = [
  'PO',
  'Contract',
  'Quote',
  'Online - Digikey',
  'Online - Mouser',
  'Online - LCSC',
  'Online - Farnell',
  'EXIM',
]

// --- HELPER FUNCTIONS ---
export const buildDefaultSettings = (name = 'Default'): AppSettings => ({
  name,
  users: { rfqAssigneeMap: {}, quoteAssigneeMap: {} },
  prices: {
    mappingItemId: {
      'Direct - Materials': 'Item ID',
      'Indirect - Materials': 'Item ID',
      'Direct - Capex': 'Item ID',
      'Indirect - Capex': 'Item ID',
    },
    itemIdOptions: ['MPN ID', 'HSN Code', 'Item ID'],
    sourcesByMapping: DEFAULT_MAPPING_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: ['PO', 'Contract', 'Quote'] as PriceSource[] }),
      {} as Record<MappingId, PriceSource[]>,
    ),
  },
  actions: {
    purpose: 'Quote',
    itemIdType: 'MPN',
    sources: ['PO', 'Contract', 'Quote'],
    maxAgeDays: 365,
    criteria: [],
  },
})

export function allowedSourcesForItemIdType(t: ItemIdType): PriceSource[] {
  if (t === 'HSN') return ['Quote', 'PO', 'Contract', 'EXIM']
  return DEFAULT_PRICE_SOURCES
}

// --- PROPS TYPE ---
type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  allTags: string[]
  allCustomers: string[]
  current: AppSettings
  onSave: (settings: AppSettings) => void
  initialTab?: 'users' | 'prices' | 'actions'
}

// Action Formula Types
type ActionFormula = {
  id: string
  purpose: ActionPurpose
  itemIdType: ItemIdType
  source: PriceSource
  dateOperator: 'before' | 'after' | 'range'
  dateValue: string
  action: string
}

// Criteria builder types
type CriteriaField = 'Tag' | 'Item ID' | 'Description' | 'Quantity' | 'Pending Qty' | 'Desired Price' | 'RFQ Assignee' | 'PO Assignee' | 'MPN' | 'ERP Code' | 'CPN' | 'HSN' | 'Requisition ID'
type CriteriaOperator = 'is' | 'is not' | 'contains' | '=' | '>' | '<' | '>=' | '<='
export type ActionCriterion = {
  id: string
  conjunction: 'WHERE' | 'AND' | 'OR'
  field: CriteriaField
  operator: CriteriaOperator
  value: string
  unit?: string
}

// --- MAIN COMPONENT ---
export function SettingsDialog({ open, onOpenChange, allTags, allCustomers, current, onSave, initialTab = 'users' }: Props) {
  const [local, setLocal] = useState<AppSettings>(current)
  const [newItemId, setNewItemId] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])

  // Multiple formulas state
  const [actionFormulas, setActionFormulas] = useState<ActionFormula[]>([])
  const [currentFormula, setCurrentFormula] = useState<ActionFormula>({
    id: '',
    purpose: 'Quote',
    itemIdType: 'MPN',
    source: 'Online - Digikey',
    dateOperator: 'after',
    dateValue: '2024-08-01',
    action: 'Create Quote'
  })

  useEffect(() => {
    if (open) {
      const localCopy = JSON.parse(JSON.stringify(current))

      // Add default criteria for Actions if none exist
      if (!localCopy.actions.criteria || localCopy.actions.criteria.length === 0) {
        localCopy.actions.criteria = [{
          id: Date.now().toString(),
          conjunction: 'WHERE',
          field: 'Purpose',
          operator: 'is',
          value: 'Quote',
        }]
      }

      setLocal(localCopy)
      setSelectedTags([])
      setSelectedCustomers([])
      setTagSearch('')
      setCustomerSearch('')
      setActionFormulas([])
    }
  }, [open, current])

  // Event handlers
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const toggleCustomer = (c: string) => {
    setSelectedCustomers(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  const linkTagsToCustomersFor = (mapKey: 'rfqAssigneeMap' | 'quoteAssigneeMap') => {
    if (selectedTags.length === 0 || selectedCustomers.length === 0) return

    setLocal(prev => {
      const newMap = { ...prev.users[mapKey] }
      selectedTags.forEach(tag => {
        newMap[tag] = [...selectedCustomers]
      })
      return {
        ...prev,
        users: { ...prev.users, [mapKey]: newMap }
      }
    })

    setSelectedTags([])
    setSelectedCustomers([])
  }

  const removeTagMapping = (tag: string, mapKey: 'rfqAssigneeMap' | 'quoteAssigneeMap') => {
    setLocal(prev => {
      const newMap = { ...prev.users[mapKey] }
      delete newMap[tag]
      return {
        ...prev,
        users: { ...prev.users, [mapKey]: newMap }
      }
    })
  }

  const setMappingItemId = (mapping: MappingId, itemId: string) => {
    setLocal(prev => ({
      ...prev,
      prices: {
        ...prev.prices,
        mappingItemId: { ...prev.prices.mappingItemId, [mapping]: itemId }
      }
    }))
  }

  const addNewItemId = () => {
    const id = newItemId.trim()
    if (!id || local.prices.itemIdOptions.includes(id)) return

    setLocal(prev => ({
      ...prev,
      prices: {
        ...prev.prices,
        itemIdOptions: [...prev.prices.itemIdOptions, id]
      }
    }))
    setNewItemId('')
  }

  const togglePriceSource = (mapping: MappingId, source: PriceSource) => {
    setLocal(prev => {
      const sources = new Set(prev.prices.sourcesByMapping[mapping] || [])
      if (sources.has(source)) {
        sources.delete(source)
      } else {
        sources.add(source)
      }
      return {
        ...prev,
        prices: {
          ...prev.prices,
          sourcesByMapping: {
            ...prev.prices.sourcesByMapping,
            [mapping]: Array.from(sources)
          }
        }
      }
    })
  }

  // Formula handlers
  const addFormula = () => {
    const newFormula = {
      ...currentFormula,
      id: Date.now().toString(),
      action: `Create ${currentFormula.purpose}`
    }
    setActionFormulas(prev => [...prev, newFormula])
    setCurrentFormula({
      id: '',
      purpose: 'Quote',
      itemIdType: 'MPN',
      source: 'Online - Digikey',
      dateOperator: 'after',
      dateValue: '2024-08-01',
      action: 'Create Quote'
    })
  }

  const removeFormula = (id: string) => {
    setActionFormulas(prev => prev.filter(f => f.id !== id))
  }

  const updateCurrentFormula = (field: keyof ActionFormula, value: any) => {
    setCurrentFormula(prev => ({
      ...prev,
      [field]: value,
      action: field === 'purpose' ? `Create ${value}` : prev.action
    }))
  }

  const handleSave = () => {
    onSave(local)
    onOpenChange(false)
  }

  const filteredTags = allTags.filter(tag =>
    tag.toLowerCase().includes(tagSearch.toLowerCase())
  )

  const filteredCustomers = allCustomers.filter(user =>
    user.toLowerCase().includes(customerSearch.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] max-w-[2200px] h-[95vh] max-h-[1200px] p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-12 py-8 border-b bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <DialogTitle className="text-3xl font-semibold flex items-center gap-4 text-slate-900">
                <Settings2 className="h-8 w-8 text-slate-600" />
                Application Settings
              </DialogTitle>
              <DialogDescription className="text-lg text-slate-600">
                Configure automation rules for user assignment, price discovery, and workflow actions
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue={initialTab} className="h-full flex flex-col">
            <TabsList className="mx-12 mt-8 grid w-fit grid-cols-3 h-14 bg-slate-100">
              <TabsTrigger value="users" className="flex items-center gap-3 px-8 text-base font-medium">
                <Users className="h-5 w-5" />
                Users
              </TabsTrigger>
              <TabsTrigger value="prices" className="flex items-center gap-3 px-8 text-base font-medium">
                <DollarSign className="h-5 w-5" />
                Price Configuration
              </TabsTrigger>
              <TabsTrigger value="actions" className="flex items-center gap-3 px-8 text-base font-medium">
                <CheckSquare className="h-5 w-5" />
                Action Rules
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users" className="flex-1 px-12 py-8 overflow-y-auto">
              <div className="space-y-12">

                {/* Input Section */}
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900 mb-6">Input</h2>
                <Card className="border-slate-200">
                  <CardHeader className="pb-8">
                    <div className="flex items-start gap-4">
                      <Link2 className="h-6 w-6 text-slate-600 mt-1" />
                      <div>
                        <CardTitle className="text-2xl font-semibold text-slate-900">Link Tags to Users</CardTitle>
                        <CardDescription className="text-lg mt-2 text-slate-600">
                          Create assignment mappings by connecting tags with specific users
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-10">
                    <div className="grid grid-cols-2 gap-16">
                      
                      {/* Tags Selection */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <Label className="text-xl font-semibold text-slate-900">Available Tags</Label>
                          <Badge variant="secondary" className="text-sm px-3 py-1">
                            {selectedTags.length} selected
                          </Badge>
                        </div>
                        
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <Input
                            placeholder="Search tags..."
                            value={tagSearch}
                            onChange={(e) => setTagSearch(e.target.value)}
                            className="pl-12 h-12 text-base border-slate-300"
                          />
                        </div>
                        
                        <ScrollArea className="h-80 border border-slate-200 rounded-lg p-4 bg-white">
                          <div className="space-y-3">
                            {filteredTags.map(tag => (
                              <div key={tag} className="flex items-center space-x-4 p-3 rounded-md hover:bg-slate-50 transition-colors">
                                <Checkbox
                                  id={`tag-${tag}`}
                                  checked={selectedTags.includes(tag)}
                                  onCheckedChange={() => toggleTag(tag)}
                                  className="h-5 w-5"
                                />
                                <Label
                                  htmlFor={`tag-${tag}`}
                                  className="text-base cursor-pointer font-medium flex-1 text-slate-700"
                                >
                                  {tag}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>

                      {/* User Selection */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <Label className="text-xl font-semibold text-slate-900">Available Users</Label>
                          <Badge variant="secondary" className="text-sm px-3 py-1">
                            {selectedCustomers.length} selected
                          </Badge>
                        </div>
                        
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <Input
                            placeholder="Search users..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="pl-12 h-12 text-base border-slate-300"
                          />
                        </div>
                        
                        <ScrollArea className="h-80 border border-slate-200 rounded-lg p-4 bg-white">
                          <div className="space-y-3">
                            {filteredCustomers.map(customer => (
                              <div key={customer} className="flex items-center space-x-4 p-3 rounded-md hover:bg-slate-50 transition-colors">
                                <Checkbox
                                  id={`customer-${customer}`}
                                  checked={selectedCustomers.includes(customer)}
                                  onCheckedChange={() => toggleCustomer(customer)}
                                  className="h-5 w-5"
                                />
                                <Label
                                  htmlFor={`customer-${customer}`}
                                  className="text-base cursor-pointer font-medium flex-1 text-slate-700"
                                >
                                  {customer}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>

                    {/* Link buttons */}
                    <div className="flex gap-4 pt-2">
                      <Button variant="outline" className="flex-1" disabled={selectedTags.length === 0 || selectedCustomers.length === 0} onClick={() => linkTagsToCustomersFor('rfqAssigneeMap')}>
                        <Link2 className="h-5 w-5 mr-2" />Link as RFQ Assignee
                      </Button>
                      <Button variant="outline" className="flex-1" disabled={selectedTags.length === 0 || selectedCustomers.length === 0} onClick={() => linkTagsToCustomersFor('quoteAssigneeMap')}>
                        <Link2 className="h-5 w-5 mr-2" />Link as PO Assignee
                      </Button>
                    </div>

                    {/* Current Mappings */}
                    {(Object.keys(local.users.rfqAssigneeMap).length > 0 || Object.keys(local.users.quoteAssigneeMap).length > 0) && (
                      <div className="pt-4 space-y-4">
                        <Label className="text-base font-semibold text-slate-900">Current Mappings</Label>
                        <div className="grid grid-cols-2 gap-8">
                          {Object.keys(local.users.rfqAssigneeMap).length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-sm text-slate-500">RFQ Assignee</Label>
                              {Object.entries(local.users.rfqAssigneeMap).map(([tag, customers]) => (
                                <div key={tag} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="outline" className="text-xs">{tag}</Badge>
                                    <span className="text-xs text-slate-400 mx-1">→</span>
                                    {customers.map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => removeTagMapping(tag, 'rfqAssigneeMap')} className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          {Object.keys(local.users.quoteAssigneeMap).length > 0 && (
                            <div className="space-y-2">
                              <Label className="text-sm text-slate-500">PO Assignee</Label>
                              {Object.entries(local.users.quoteAssigneeMap).map(([tag, customers]) => (
                                <div key={tag} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                                  <div className="flex flex-wrap gap-1">
                                    <Badge variant="outline" className="text-xs">{tag}</Badge>
                                    <span className="text-xs text-slate-400 mx-1">→</span>
                                    {customers.map(c => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={() => removeTagMapping(tag, 'quoteAssigneeMap')} className="h-7 w-7 p-0 hover:bg-red-50 hover:text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>
                </div>

              </div>
            </TabsContent>

            {/* Prices Tab */}
            <TabsContent value="prices" className="flex-1 px-12 py-8 overflow-y-auto">
              <div className="space-y-12">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-16">
                  
                  {/* Item ID Mapping */}
                  <Card className="border-slate-200">
                    <CardHeader className="pb-8">
                      <div className="flex items-start gap-4">
                        <Building2 className="h-6 w-6 text-slate-600 mt-1" />
                        <div>
                          <CardTitle className="text-2xl font-semibold text-slate-900">Item ID Mapping</CardTitle>
                          <CardDescription className="text-lg mt-2 text-slate-600">
                            Define which Item ID to use for each mapping category
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      
                      <div className="space-y-6">
                        {DEFAULT_MAPPING_IDS.map(mapping => (
                          <div
                            key={mapping}
                            className="flex items-center justify-between p-6 bg-slate-50 rounded-lg border border-slate-200"
                          >
                            <Label className="text-lg font-semibold text-slate-900">
                              {mapping}
                            </Label>
                            <Select
                              value={local.prices.mappingItemId[mapping]}
                              onValueChange={(value) => setMappingItemId(mapping, value)}
                            >
                              <SelectTrigger className="w-56 h-12 text-base font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {local.prices.itemIdOptions.map(option => (
                                  <SelectItem key={option} value={option} className="text-base">
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>

                      <Separator className="my-8" />

                      <div className="p-6 bg-slate-50 rounded-lg border border-slate-200">
                        <Label className="text-lg font-semibold text-slate-900 mb-6 block">Add New Item ID Type</Label>
                        <div className="flex gap-4">
                          <Input
                            placeholder="e.g., CPN-Alternate, Custom-ID"
                            value={newItemId}
                            onChange={(e) => setNewItemId(e.target.value)}
                            className="h-12 text-base flex-1"
                          />
                          <Button onClick={addNewItemId} size="lg" className="h-12 px-8">
                            <Plus className="h-5 w-5 mr-2" />
                            Add Type
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Price Sources */}
                  <Card className="border-slate-200">
                    <CardHeader className="pb-8">
                      <div className="flex items-start gap-4">
                        <Globe className="h-6 w-6 text-slate-600 mt-1" />
                        <div>
                          <CardTitle className="text-2xl font-semibold text-slate-900">Price Sources</CardTitle>
                          <CardDescription className="text-lg mt-2 text-slate-600">
                            Configure available sources for price comparison
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[700px] pr-4">
                        <div className="space-y-10">
                          {DEFAULT_MAPPING_IDS.map(mapping => (
                            <div key={mapping} className="space-y-6">
                              <div className="border-b border-slate-200 pb-4">
                                <Label className="text-xl font-semibold text-slate-900">{mapping}</Label>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                {DEFAULT_PRICE_SOURCES.map(source => {
                                  const isActive = (local.prices.sourcesByMapping[mapping] || []).includes(source)
                                  return (
                                    <button
                                      key={source}
                                      type="button"
                                      onClick={() => togglePriceSource(mapping, source)}
                                      className={cn(
                                        "p-4 text-base rounded-lg border transition-all duration-200 font-medium text-left",
                                        isActive
                                          ? "bg-slate-900 text-white border-slate-900"
                                          : "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700"
                                      )}
                                    >
                                      {source}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="flex-1 px-12 py-8 overflow-y-auto">
              <div className="space-y-12">
                
                <Card className="border-slate-200">
                  <CardHeader className="pb-8">
                    <div className="flex items-start gap-4">
                      <Filter className="h-6 w-6 text-slate-600 mt-1" />
                      <div>
                        <CardTitle className="text-2xl font-semibold text-slate-900">Action Formula Builder</CardTitle>
                        <CardDescription className="text-lg mt-2 text-slate-600">
                          Create conditional rules to automatically assign actions based on criteria
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-10">
                    
                    {/* Formula Builder */}
                    <div className="p-8 border border-slate-200 rounded-lg bg-slate-50">
                      <Label className="text-lg font-semibold mb-8 block text-slate-900">
                        Build New Rule
                      </Label>

                      <div className="space-y-8">
                        {/* If Statement */}
                        <div className="flex flex-wrap items-center gap-4 text-lg">
                          <span className="font-semibold text-slate-900 bg-white px-4 py-2 rounded-md border border-slate-200">IF</span>

                          {/* Purpose */}
                          <span className="text-slate-600">purpose is</span>
                          <Select
                            value={currentFormula.purpose}
                            onValueChange={(value) => updateCurrentFormula('purpose', value)}
                          >
                            <SelectTrigger className="w-32 h-12 font-semibold text-base">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Quote">Quote</SelectItem>
                              <SelectItem value="PO">PO</SelectItem>
                              <SelectItem value="Contract">Contract</SelectItem>
                            </SelectContent>
                          </Select>

                          <span className="font-semibold text-slate-900 bg-white px-3 py-2 rounded-md border border-slate-200">AND</span>

                          {/* Item ID */}
                          <span className="text-slate-600">item ID is</span>
                          <Select
                            value={currentFormula.itemIdType}
                            onValueChange={(value) => updateCurrentFormula('itemIdType', value)}
                          >
                            <SelectTrigger className="w-28 h-12 font-semibold text-base">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MPN">MPN</SelectItem>
                              <SelectItem value="CPN">CPN</SelectItem>
                              <SelectItem value="HSN">HSN</SelectItem>
                            </SelectContent>
                          </Select>

                          <span className="font-semibold text-slate-900 bg-white px-3 py-2 rounded-md border border-slate-200">AND</span>

                          {/* Source */}
                          <span className="text-slate-600">source is</span>
                          <Select
                            value={currentFormula.source}
                            onValueChange={(value) => updateCurrentFormula('source', value)}
                          >
                            <SelectTrigger className="w-40 h-12 font-semibold text-base">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PO">PO</SelectItem>
                              <SelectItem value="Contract">Contract</SelectItem>
                              <SelectItem value="Quote">Quote</SelectItem>
                              <SelectItem value="Online - Digikey">Digikey</SelectItem>
                              <SelectItem value="Online - Mouser">Mouser</SelectItem>
                              <SelectItem value="Online - LCSC">LCSC</SelectItem>
                              <SelectItem value="Online - Farnell">Farnell</SelectItem>
                              <SelectItem value="EXIM">EXIM</SelectItem>
                            </SelectContent>
                          </Select>

                          <span className="font-semibold text-slate-900 bg-white px-3 py-2 rounded-md border border-slate-200">AND</span>

                          {/* Date */}
                          <span className="text-slate-600">date is</span>
                          <Select
                            value={currentFormula.dateOperator}
                            onValueChange={(value) => updateCurrentFormula('dateOperator', value)}
                          >
                            <SelectTrigger className="w-32 h-12 font-semibold text-base">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="before">before</SelectItem>
                              <SelectItem value="after">after</SelectItem>
                              <SelectItem value="range">range</SelectItem>
                            </SelectContent>
                          </Select>

                          <Input
                            type="date"
                            value={currentFormula.dateValue}
                            onChange={(e) => updateCurrentFormula('dateValue', e.target.value)}
                            className="w-40 h-12 font-semibold text-base"
                          />
                        </div>

                        {/* Then Statement */}
                        <div className="flex flex-wrap items-center gap-4 text-lg">
                          <span className="font-semibold text-slate-900 bg-white px-4 py-2 rounded-md border border-slate-200">THEN</span>
                          <span className="text-slate-600">action is</span>
                          <span className="font-semibold bg-white px-4 py-2 rounded-md border border-slate-200 text-slate-900">
                            {currentFormula.action}
                          </span>
                        </div>
                      </div>

                      {/* Add Formula Button */}
                      <div className="mt-8 flex justify-end">
                        <Button onClick={addFormula} size="lg" className="h-12 px-8">
                          <Plus className="mr-3 h-5 w-5" />
                          Add Rule
                        </Button>
                      </div>
                    </div>

                    {/* Created Rules */}
                    {actionFormulas.length > 0 && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <CheckSquare className="h-6 w-6 text-slate-600" />
                          <Label className="text-xl font-semibold text-slate-900">
                            Active Rules ({actionFormulas.length})
                          </Label>
                        </div>
                        <div className="space-y-4">
                          {actionFormulas.map((formula) => (
                            <div key={formula.id} className="p-6 border border-slate-200 rounded-lg bg-white">
                              <div className="flex items-center justify-between">
                                <div className="text-base flex flex-wrap items-center gap-2">
                                  <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded font-semibold">IF</span>
                                  <span>purpose = <strong>{formula.purpose}</strong></span>
                                  <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded font-semibold">AND</span>
                                  <span>item ID is <strong>{formula.itemIdType}</strong></span>
                                  <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded font-semibold">AND</span>
                                  <span>source is <strong>{formula.source}</strong></span>
                                  <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded font-semibold">AND</span>
                                  <span>date is {formula.dateOperator} <strong>{new Date(formula.dateValue).toLocaleDateString()}</strong>,</span>
                                  <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded font-semibold">THEN</span>
                                  <span>action is <strong>{formula.action}</strong></span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeFormula(formula.id)}
                                  className="ml-4 h-10 w-10 p-0 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="px-12 py-8 border-t bg-slate-50">
          <div className="flex items-center gap-6 mr-auto">
            <Label className="text-lg font-semibold text-slate-900">Profile Name:</Label>
            <Input
              value={local.name}
              onChange={(e) => setLocal(prev => ({ ...prev, name: e.target.value }))}
              className="w-56 h-12 text-base font-medium"
            />
          </div>
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="lg" className="h-12 px-8">
              Cancel
            </Button>
            <Button onClick={handleSave} size="lg" className="h-12 px-8">
              Save Settings
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Embedded settings content that can be rendered inside a custom popup
type RoleUser = { user_id: string; name: string; email: string }

export function SettingsPanel({
  allTags,
  allCustomers,
  allItemIds = [],
  availableUsers = [],
  rfqResponsibleUsers = [],
  quoteResponsibleUsers = [],
  current,
  onSave,
  onCancel,
  initialTab = 'users',
}: {
  allTags: string[]
  allCustomers: string[]
  allItemIds?: string[]
  availableUsers?: RoleUser[]
  rfqResponsibleUsers?: RoleUser[]
  quoteResponsibleUsers?: RoleUser[]
  current: AppSettings
  onSave: (s: AppSettings) => void
  onCancel: () => void
  initialTab?: 'users' | 'prices' | 'actions'
}) {
  const [local, setLocal] = useState<AppSettings>(current)
  const [newItemId, setNewItemId] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  // Multiple formulas state
  const [actionFormulas, setActionFormulas] = useState<ActionFormula[]>([])
  const [currentFormula, setCurrentFormula] = useState<ActionFormula>({
    id: '',
    purpose: 'Quote',
    itemIdType: 'MPN',
    source: 'Online - Digikey',
    dateOperator: 'after',
    dateValue: '2024-08-01',
    action: 'Create Quote'
  })

  useEffect(() => {
    // Reset content whenever current changes
    const localCopy = JSON.parse(JSON.stringify(current))

    // Add default criteria for Actions if none exist
    if (!localCopy.actions.criteria || localCopy.actions.criteria.length === 0) {
      localCopy.actions.criteria = [{
        id: Date.now().toString(),
        conjunction: 'WHERE',
        field: 'Purpose',
        operator: 'is',
        value: 'Quote',
      }]
    }

    setLocal(localCopy)
    setSelectedTags([])
    setSelectedCustomers([])
    setTagSearch('')
    setCustomerSearch('')
    setActionFormulas([])
  }, [current])

  // Handlers
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const toggleCustomer = (c: string) => {
    setSelectedCustomers(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  const linkTagsToCustomersFor = (mapKey: 'rfqAssigneeMap' | 'quoteAssigneeMap') => {
    if (selectedTags.length === 0 || selectedCustomers.length === 0) return
    setLocal(prev => {
      const newMap = { ...prev.users[mapKey] }
      selectedTags.forEach(tag => {
        newMap[tag] = [...selectedCustomers]
      })
      return { ...prev, users: { ...prev.users, [mapKey]: newMap } }
    })
    setSelectedTags([])
    setSelectedCustomers([])
  }

  const removeTagMapping = (tag: string, mapKey: 'rfqAssigneeMap' | 'quoteAssigneeMap') => {
    setLocal(prev => {
      const newMap = { ...prev.users[mapKey] }
      delete newMap[tag]
      return { ...prev, users: { ...prev.users, [mapKey]: newMap } }
    })
  }

  const setMappingItemId = (mapping: MappingId, itemId: string) => {
    setLocal(prev => ({
      ...prev,
      prices: { ...prev.prices, mappingItemId: { ...prev.prices.mappingItemId, [mapping]: itemId } },
    }))
  }

  const addNewItemId = () => {
    const id = newItemId.trim()
    if (!id || local.prices.itemIdOptions.includes(id)) return
    setLocal(prev => ({
      ...prev,
      prices: { ...prev.prices, itemIdOptions: [...prev.prices.itemIdOptions, id] },
    }))
    setNewItemId('')
  }

  const togglePriceSource = (mapping: MappingId, source: PriceSource) => {
    setLocal(prev => {
      const sources = new Set(prev.prices.sourcesByMapping[mapping] || [])
      if (sources.has(source)) sources.delete(source)
      else sources.add(source)
      return {
        ...prev,
        prices: {
          ...prev.prices,
          sourcesByMapping: { ...prev.prices.sourcesByMapping, [mapping]: Array.from(sources) },
        },
      }
    })
  }

  const addFormula = () => {
    const newFormula = { ...currentFormula, id: Date.now().toString(), action: `Create ${currentFormula.purpose}` }
    setActionFormulas(prev => [...prev, newFormula])
    setCurrentFormula({
      id: '',
      purpose: 'Quote',
      itemIdType: 'MPN',
      source: 'Online - Digikey',
      dateOperator: 'after',
      dateValue: '2024-08-01',
      action: 'Create Quote',
    })
  }

  const removeFormula = (id: string) => setActionFormulas(prev => prev.filter(f => f.id !== id))
  const updateCurrentFormula = (field: keyof ActionFormula, value: any) =>
    setCurrentFormula(prev => ({ ...prev, [field]: value, action: field === 'purpose' ? `Create ${value}` : prev.action }))

  const filteredTags = allTags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase()))
  const filteredCustomers = allCustomers.filter(user => user.toLowerCase().includes(customerSearch.toLowerCase()))

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="px-10 py-6 border-b bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="text-2xl font-semibold flex items-center gap-3 text-slate-900">
              <Settings2 className="h-6 w-6 text-slate-600" />
              Application Settings
            </div>
            <div className="text-slate-600">Configure users, price sources, and action rules</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue={initialTab} className="h-full flex flex-col">
          <TabsList className="mx-10 mt-6 grid w-fit grid-cols-3 h-12 bg-slate-100">
            <TabsTrigger value="users" className="flex items-center gap-2 px-6 text-sm font-medium">
              <Users className="h-4 w-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="prices" className="flex items-center gap-2 px-6 text-sm font-medium">
              <DollarSign className="h-4 w-4" /> Prices
            </TabsTrigger>
            <TabsTrigger value="actions" className="flex items-center gap-2 px-6 text-sm font-medium">
              <CheckSquare className="h-4 w-4" /> Actions
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="flex-1 px-10 py-6 overflow-y-auto">
            <div className="space-y-8">
              {/* Input */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Input</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card>
                    <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Search tags..." value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} className="pl-10" />
                        </div>
                        <ScrollArea className="h-56 border rounded-md p-2">
                          <div className="flex flex-wrap gap-2">
                            {filteredTags.map(tag => (
                              <Badge key={tag} variant={selectedTags.includes(tag) ? 'default' : 'secondary'} onClick={() => toggleTag(tag)} className="cursor-pointer">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle>Users</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Search users..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="pl-10" />
                        </div>
                        <ScrollArea className="h-56 border rounded-md p-2">
                          <div className="space-y-2">
                            {filteredCustomers.map(customer => (
                              <div key={customer} className="flex items-center space-x-2">
                                <Checkbox id={`customer-${customer}`} checked={selectedCustomers.includes(customer)} onCheckedChange={() => toggleCustomer(customer)} />
                                <Label htmlFor={`customer-${customer}`} className="text-sm cursor-pointer">{customer}</Label>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Link buttons */}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" disabled={selectedTags.length === 0 || selectedCustomers.length === 0} onClick={() => linkTagsToCustomersFor('rfqAssigneeMap')}>
                  <Link2 className="h-4 w-4 mr-2" />Link as RFQ Assignee
                </Button>
                <Button variant="outline" className="flex-1" disabled={selectedTags.length === 0 || selectedCustomers.length === 0} onClick={() => linkTagsToCustomersFor('quoteAssigneeMap')}>
                  <Link2 className="h-4 w-4 mr-2" />Link as PO Assignee
                </Button>
              </div>

              {/* Current Mappings */}
              {(Object.keys(local.users.rfqAssigneeMap).length > 0 || Object.keys(local.users.quoteAssigneeMap).length > 0) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">Current Mappings</h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.keys(local.users.rfqAssigneeMap).length > 0 && (
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">RFQ Assignee</CardTitle></CardHeader>
                        <CardContent className="space-y-1">
                          {Object.entries(local.users.rfqAssigneeMap).map(([tag, users]) => (
                            <div key={tag} className="flex items-center justify-between p-2 border rounded-md">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-xs">{tag}</Badge>
                                <span className="text-xs text-muted-foreground mx-1">→</span>
                                {users.map(u => <Badge key={u} variant="secondary" className="text-xs">{u}</Badge>)}
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600" onClick={() => removeTagMapping(tag, 'rfqAssigneeMap')}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                    {Object.keys(local.users.quoteAssigneeMap).length > 0 && (
                      <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">PO Assignee</CardTitle></CardHeader>
                        <CardContent className="space-y-1">
                          {Object.entries(local.users.quoteAssigneeMap).map(([tag, users]) => (
                            <div key={tag} className="flex items-center justify-between p-2 border rounded-md">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-xs">{tag}</Badge>
                                <span className="text-xs text-muted-foreground mx-1">→</span>
                                {users.map(u => <Badge key={u} variant="secondary" className="text-xs">{u}</Badge>)}
                              </div>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600" onClick={() => removeTagMapping(tag, 'quoteAssigneeMap')}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}

            </div>
          </TabsContent>

          {/* Prices Tab */}
          <TabsContent value="prices" className="flex-1 px-10 py-6 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Item ID Mapping */}
              <Card>
                <CardHeader>
                  <CardTitle>Item ID Mapping</CardTitle>
                  <CardDescription className="text-gray-600">
                    Define which Item ID to use for each mapping type
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {DEFAULT_MAPPING_IDS.map(mapping => (
                    <div key={mapping} className="grid grid-cols-[1fr,12rem] items-center gap-4">
                      <Label className="text-sm font-medium whitespace-nowrap pr-2">{mapping}</Label>
                      <Select value={local.prices.mappingItemId[mapping]} onValueChange={(value) => setMappingItemId(mapping, value)}>
                        <SelectTrigger className="w-48 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {local.prices.itemIdOptions.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-2">
                    <Label>Add New Item ID</Label>
                    <div className="flex gap-2">
                      <Input placeholder="e.g., CPN-Alternate" value={newItemId} onChange={(e) => setNewItemId(e.target.value)} />
                      <Button onClick={addNewItemId} size="sm"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Sources */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle>Price Sources</CardTitle>
                  <CardDescription className="text-gray-600">Select sources for price comparison</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-white overflow-hidden">
                    <ScrollArea className="h-96 rounded-md">
                      <div className="space-y-5 p-4 pr-5">
                        {DEFAULT_MAPPING_IDS.map(mapping => (
                          <div key={mapping}>
                            <Label className="text-sm font-semibold text-gray-800">{mapping}</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-3 mt-2">
                              {DEFAULT_PRICE_SOURCES.map(source => {
                                const isActive = (local.prices.sourcesByMapping[mapping] || []).includes(source)
                                return (
                                  <button
                                    key={source}
                                    type="button"
                                    onClick={() => togglePriceSource(mapping, source)}
                                    className={cn(
                                      "w-full justify-start text-left px-3 py-2 text-sm rounded-md border transition-colors",
                                      isActive ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                                    )}
                                  >
                                    {source}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="flex-1 px-10 py-6 overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Action Rules</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Each rule evaluates independently. Items matching a rule get that action assigned.</p>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 border border-blue-300 rounded-md px-3 py-1.5 hover:bg-blue-50"
                  onClick={() => setLocal(prev => ({
                    ...prev,
                    actions: {
                      ...prev.actions,
                      formulas: [...(prev.actions.formulas || []), {
                        id: Date.now().toString(),
                        criteria: [{ id: Date.now().toString() + '_c', conjunction: 'WHERE' as const, field: 'Tag' as const, operator: 'is' as const, value: '' }],
                        assignAction: 'RFQ',
                      }],
                    },
                  }))}
                >
                  + Add Rule
                </button>
              </div>

              {(local.actions.formulas || []).length === 0 && (
                <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-lg">
                  <p className="text-sm">No rules yet. Click <strong>+ Add Rule</strong> to create one.</p>
                </div>
              )}

              {(local.actions.formulas || []).map((rule, ruleIdx) => (
                <div key={rule.id} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                  {/* Rule header */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rule {ruleIdx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setLocal(prev => ({ ...prev, actions: { ...prev.actions, formulas: (prev.actions.formulas || []).filter(r => r.id !== rule.id) } }))}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Remove rule
                    </button>
                  </div>

                  {/* Criteria rows */}
                  <div className="space-y-2">
                    {rule.criteria.map((row, idx) => {
                      const updateCriteria = (updater: (c: ActionCriterion[]) => ActionCriterion[]) =>
                        setLocal(prev => ({
                          ...prev,
                          actions: {
                            ...prev.actions,
                            formulas: (prev.actions.formulas || []).map(f => f.id === rule.id ? { ...f, criteria: updater(f.criteria) } : f),
                          },
                        }))

                      return (
                        <div key={row.id} className="flex flex-wrap items-center gap-2 bg-white p-2 rounded border">
                          {idx === 0 ? (
                            <span className="text-xs font-semibold text-gray-500 w-12">WHERE</span>
                          ) : (
                            <Select value={row.conjunction} onValueChange={(v) => updateCriteria(cs => cs.map(r => r.id === row.id ? { ...r, conjunction: v as any } : r))}>
                              <SelectTrigger className="w-16 text-xs border-blue-300 bg-blue-50"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}

                          <Select value={row.field} onValueChange={(v) => updateCriteria(cs => cs.map(r => r.id === row.id ? { ...r, field: v as any, operator: 'is', value: '' } : r))}>
                            <SelectTrigger className="w-36 text-xs border-blue-300 bg-blue-50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Tag">Tag</SelectItem>
                              <SelectItem value="Item ID">Item ID</SelectItem>
                              <SelectItem value="Description">Description</SelectItem>
                              <SelectItem value="Quantity">Quantity</SelectItem>
                              <SelectItem value="Pending Qty">Pending Qty</SelectItem>
                              <SelectItem value="Desired Price">Desired Price</SelectItem>
                              <SelectItem value="RFQ Assignee">RFQ Assignee</SelectItem>
                              <SelectItem value="PO Assignee">PO Assignee</SelectItem>
                              <SelectItem value="MPN">MPN</SelectItem>
                              <SelectItem value="ERP Code">ERP Code</SelectItem>
                              <SelectItem value="CPN">CPN</SelectItem>
                              <SelectItem value="HSN">HSN</SelectItem>
                              <SelectItem value="Requisition ID">Requisition ID</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select value={row.operator} onValueChange={(v) => updateCriteria(cs => cs.map(r => r.id === row.id ? { ...r, operator: v as any } : r))}>
                            <SelectTrigger className="w-24 text-xs border-blue-300 bg-blue-50"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['Quantity', 'Pending Qty', 'Desired Price'].includes(row.field) ? (
                                <>
                                  <SelectItem value=">=">&ge;</SelectItem>
                                  <SelectItem value="<=">&le;</SelectItem>
                                  <SelectItem value=">">{'>'}</SelectItem>
                                  <SelectItem value="<">{'<'}</SelectItem>
                                  <SelectItem value="=">=</SelectItem>
                                </>
                              ) : (
                                <>
                                  <SelectItem value="is">is</SelectItem>
                                  <SelectItem value="is not">is not</SelectItem>
                                  <SelectItem value="contains">contains</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>

                          {row.field === 'Tag' ? (
                            <Select value={row.value} onValueChange={(v) => updateCriteria(cs => cs.map(r => r.id === row.id ? { ...r, value: v } : r))}>
                              <SelectTrigger className="w-40 text-xs border-blue-300 bg-blue-50"><SelectValue placeholder="Select tag" /></SelectTrigger>
                              <SelectContent>{allTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : row.field === 'Item ID' ? (
                            <Select value={row.value} onValueChange={(v) => updateCriteria(cs => cs.map(r => r.id === row.id ? { ...r, value: v } : r))}>
                              <SelectTrigger className="w-40 text-xs border-blue-300 bg-blue-50"><SelectValue placeholder="Select item" /></SelectTrigger>
                              <SelectContent>{(allItemIds || []).map(id => <SelectItem key={id} value={id}>{id}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (row.field === 'RFQ Assignee' || row.field === 'PO Assignee') ? (
                            <Select value={row.value} onValueChange={(v) => updateCriteria(cs => cs.map(r => r.id === row.id ? { ...r, value: v } : r))}>
                              <SelectTrigger className="w-40 text-xs border-blue-300 bg-blue-50"><SelectValue placeholder="Select user" /></SelectTrigger>
                              <SelectContent>{allCustomers.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Input
                              className="w-36 text-xs border-blue-300 bg-blue-50"
                              type={['Quantity', 'Pending Qty', 'Desired Price'].includes(row.field) ? 'number' : 'text'}
                              placeholder="Value"
                              value={row.value}
                              onChange={(e) => updateCriteria(cs => cs.map(r => r.id === row.id ? { ...r, value: e.target.value } : r))}
                            />
                          )}

                          {idx === rule.criteria.length - 1 && (
                            <>
                              <span className="text-xs font-semibold text-gray-600 mx-1">→ THEN</span>
                              <Select
                                value={rule.assignAction}
                                onValueChange={(v) => setLocal(prev => ({
                                  ...prev,
                                  actions: {
                                    ...prev.actions,
                                    formulas: (prev.actions.formulas || []).map(f => f.id === rule.id ? { ...f, assignAction: v } : f),
                                  },
                                }))}
                              >
                                <SelectTrigger className="w-28 text-xs border-green-300 bg-green-50"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="RFQ">RFQ</SelectItem>
                                  <SelectItem value="Direct PO">Direct PO</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}

                          {idx > 0 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateCriteria(cs => cs.filter(r => r.id !== row.id))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Add condition */}
                  <div className="pt-1">
                    <button
                      type="button"
                      className="text-blue-600 text-xs font-medium hover:underline"
                      onClick={() => setLocal(prev => ({
                        ...prev,
                        actions: {
                          ...prev.actions,
                          formulas: (prev.actions.formulas || []).map(f => f.id === rule.id ? {
                            ...f,
                            criteria: [...f.criteria, { id: Date.now().toString(), conjunction: 'AND' as const, field: 'Tag' as const, operator: 'is' as const, value: '' }],
                          } : f),
                        },
                      }))}
                    >
                      + Add Condition
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="px-10 py-6 border-t bg-slate-50 flex items-center gap-2 justify-end">
        <div className="flex items-center gap-4 mr-auto">
          <Label>Profile Name:</Label>
          <Input value={local.name} onChange={(e) => setLocal(prev => ({ ...prev, name: e.target.value }))} className="w-40" />
        </div>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(local)}>Save Settings</Button>
      </div>
    </div>
  )
}
