'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  DollarSign,
  CheckSquare,
  Settings,
  ArrowRight
} from 'lucide-react'
import { AppSettings } from '@/components/settings-dialog'

// Types
interface AutoAssignUsersPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedItemsCount: number
  currentSettings: AppSettings
  onExecute: (scope: 'all' | 'unassigned' | 'selected') => void
  onOpenSettings: () => void
}

interface AutoFillPricesPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedItemsCount: number
  currentSettings: AppSettings
  onExecute: (scope: 'all' | 'non-selected' | 'selected') => void
  onOpenSettings: () => void
}

interface AutoAssignActionsPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedItemsCount: number
  currentSettings: AppSettings
  onExecute: (scope: 'all' | 'unassigned' | 'selected') => void
  onOpenSettings: () => void
}

// AutoAssign Users Popover Component
export function AutoAssignUsersPopover({
  open,
  onOpenChange,
  selectedItemsCount,
  currentSettings,
  onExecute,
  onOpenSettings
}: AutoAssignUsersPopoverProps) {
  const rfqCount = Object.keys(currentSettings.users.rfqAssigneeMap || {}).length
  const quoteCount = Object.keys(currentSettings.users.quoteAssigneeMap || {}).length
  const hasTagMappings = rfqCount + quoteCount > 0

  const handleExecute = (scope: 'all' | 'unassigned' | 'selected') => {
    onExecute(scope)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            Auto Assign Users
          </DialogTitle>
          <DialogDescription>
            Assign users to items based on your tag-user mappings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Settings Preview */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">Tag Mappings: </span>
                <span className="text-muted-foreground">
                  {hasTagMappings ? `${rfqCount + quoteCount} configured` : 'None configured'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={onOpenSettings}>
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>
          </div>

          {/* Action Options */}
          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all group"
              onClick={() => handleExecute('all')}
            >
              <div>
                <div className="font-medium text-gray-900 group-hover:text-blue-700">All items</div>
                <div className="text-sm text-gray-500">Assign users to every item in the table</div>
              </div>
              <ArrowRight className="h-4 w-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all group"
              onClick={() => handleExecute('unassigned')}
            >
              <div>
                <div className="font-medium text-gray-900 group-hover:text-blue-700">Unassigned items only</div>
                <div className="text-sm text-gray-500">Assign users to items without assignments</div>
              </div>
              <ArrowRight className="h-4 w-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div
              className={`flex items-center justify-between p-4 rounded-lg border border-gray-200 transition-all ${
                selectedItemsCount === 0
                  ? 'opacity-50 cursor-not-allowed bg-gray-50'
                  : 'hover:border-blue-300 hover:bg-blue-50 cursor-pointer group'
              }`}
              onClick={() => selectedItemsCount > 0 && handleExecute('selected')}
            >
              <div>
                <div className={`font-medium ${selectedItemsCount === 0 ? 'text-gray-400' : 'text-gray-900 group-hover:text-blue-700'}`}>
                  Selected items
                </div>
                <div className={`text-sm ${selectedItemsCount === 0 ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedItemsCount === 0 ? 'No items selected' : `Assign users to ${selectedItemsCount} selected items`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedItemsCount > 0 ? "default" : "secondary"}>
                  {selectedItemsCount}
                </Badge>
                {selectedItemsCount > 0 && (
                  <ArrowRight className="h-4 w-4 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          </div>

          {!hasTagMappings && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                Configure tag-user mappings in settings to enable auto-assignment
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// AutoFill Prices Popover Component
export function AutoFillPricesPopover({
  open,
  onOpenChange,
  selectedItemsCount,
  currentSettings,
  onExecute,
  onOpenSettings
}: AutoFillPricesPopoverProps) {
  const hasConfiguredSources = Object.values(currentSettings.prices.sourcesByMapping || {})
    .some(sources => sources.length > 0)

  const handleExecute = (scope: 'all' | 'non-selected' | 'selected') => {
    onExecute(scope)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            Auto Fill Prices
          </DialogTitle>
          <DialogDescription>
            Fill prices automatically by finding the cheapest from your configured sources.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Settings Preview */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">Price Sources: </span>
                <span className="text-muted-foreground">
                  {hasConfiguredSources ? 'Configured' : 'None configured'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={onOpenSettings}>
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>
          </div>

          {/* Action Options */}
          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 cursor-pointer transition-all group"
              onClick={() => handleExecute('all')}
            >
              <div>
                <div className="font-medium text-gray-900 group-hover:text-green-700">Autofill prices for all items</div>
                <div className="text-sm text-gray-500">Fill prices for all items in the table</div>
              </div>
              <ArrowRight className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 cursor-pointer transition-all group"
              onClick={() => handleExecute('non-selected')}
            >
              <div>
                <div className="font-medium text-gray-900 group-hover:text-green-700">Autofill prices for non-selected items</div>
                <div className="text-sm text-gray-500">Fill prices for all items that have not been selected</div>
              </div>
              <ArrowRight className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div
              className={`flex items-center justify-between p-4 rounded-lg border border-gray-200 transition-all ${
                selectedItemsCount === 0
                  ? 'opacity-50 cursor-not-allowed bg-gray-50'
                  : 'hover:border-green-300 hover:bg-green-50 cursor-pointer group'
              }`}
              onClick={() => selectedItemsCount > 0 && handleExecute('selected')}
            >
              <div>
                <div className={`font-medium ${selectedItemsCount === 0 ? 'text-gray-400' : 'text-gray-900 group-hover:text-green-700'}`}>
                  Autofill prices for selected items
                </div>
                <div className={`text-sm ${selectedItemsCount === 0 ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedItemsCount === 0 ? 'No items selected' : `Fill prices for ${selectedItemsCount} selected items`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedItemsCount > 0 ? "default" : "secondary"}>
                  {selectedItemsCount}
                </Badge>
                {selectedItemsCount > 0 && (
                  <ArrowRight className="h-4 w-4 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          </div>

          {!hasConfiguredSources && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                Configure price sources in settings to enable auto-fill
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// AutoAssign Actions Popover Component
export function AutoAssignActionsPopover({
  open,
  onOpenChange,
  selectedItemsCount,
  currentSettings,
  onExecute,
  onOpenSettings
}: AutoAssignActionsPopoverProps) {
  const hasActionSettings = currentSettings.actions.sources.length > 0

  const handleExecute = (scope: 'all' | 'unassigned' | 'selected') => {
    onExecute(scope)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[420px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckSquare className="h-5 w-5 text-purple-600" />
            </div>
            Assign Actions
          </DialogTitle>
          <DialogDescription>
            Automatically assign next actions based on price and vendor availability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Settings Preview */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="font-medium">Action Rules: </span>
                <span className="text-muted-foreground">
                  {hasActionSettings ? `${currentSettings.actions.purpose} (${currentSettings.actions.itemIdType})` : 'Basic rules only'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={onOpenSettings}>
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>
          </div>


          {/* Action Options */}
          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all group"
              onClick={() => handleExecute('all')}
            >
              <div>
                <div className="font-medium text-gray-900 group-hover:text-purple-700">Autoassign for all items</div>
                <div className="text-sm text-gray-500">Assign actions to every item in the table</div>
              </div>
              <ArrowRight className="h-4 w-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div
              className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all group"
              onClick={() => handleExecute('unassigned')}
            >
              <div>
                <div className="font-medium text-gray-900 group-hover:text-purple-700">Autoassign for non-assigned items</div>
                <div className="text-sm text-gray-500">Assign actions to items without actions</div>
              </div>
              <ArrowRight className="h-4 w-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div
              className={`flex items-center justify-between p-4 rounded-lg border border-gray-200 transition-all ${
                selectedItemsCount === 0
                  ? 'opacity-50 cursor-not-allowed bg-gray-50'
                  : 'hover:border-purple-300 hover:bg-purple-50 cursor-pointer group'
              }`}
              onClick={() => selectedItemsCount > 0 && handleExecute('selected')}
            >
              <div>
                <div className={`font-medium ${selectedItemsCount === 0 ? 'text-gray-400' : 'text-gray-900 group-hover:text-purple-700'}`}>
                  Autoassign for selected items
                </div>
                <div className={`text-sm ${selectedItemsCount === 0 ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedItemsCount === 0 ? 'No items selected' : `Assign actions to ${selectedItemsCount} selected items`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedItemsCount > 0 ? "default" : "secondary"}>
                  {selectedItemsCount}
                </Badge>
                {selectedItemsCount > 0 && (
                  <ArrowRight className="h-4 w-4 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}