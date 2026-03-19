/**
 * Factwise Backend API Client
 *
 * This module provides functions to interact with the Factwise backend APIs
 * for the Strategy Dashboard.
 */

// API Configuration
// URL can be controlled via:
// 1. ?api_url query param (passed from Factwise iframe - highest priority for local dev)
// 2. NEXT_PUBLIC_API_URL env var (if local address, always use it - for local dev)
// 3. ?api_env=prod or ?api_env=dev query param (from Factwise iframe)
// 4. Default fallback to /dev
const getApiBaseUrl = (): string => {
  // Check for api_url query param first (passed from Factwise for local dev)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const apiUrlParam = urlParams.get('api_url');
    // If api_url is a local address, use it (for local development)
    if (apiUrlParam && (apiUrlParam.includes('localhost') || apiUrlParam.includes('192.168.') || apiUrlParam.includes('127.0.0.1'))) {
      return apiUrlParam;
    }
  }

  // Get env URL safely (process may not exist in some browser contexts)
  const envUrl = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : undefined;

  // If env var is set to local address, ALWAYS use it (local development priority)
  const isLocalUrl = envUrl && (envUrl.includes('localhost') || envUrl.includes('192.168.') || envUrl.includes('127.0.0.1'));
  if (isLocalUrl) {
    return envUrl;
  }

  // Check query param (only in browser)
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const apiEnv = urlParams.get('api_env');
    if (apiEnv === 'prod') {
      return 'https://qc9s5bz8d7.execute-api.us-east-1.amazonaws.com/prod';
    }
    if (apiEnv === 'dev') {
      return 'https://poiigw0go0.execute-api.us-east-1.amazonaws.com/dev';
    }
  }
  // Fall back to env var or default
  return envUrl || 'https://poiigw0go0.execute-api.us-east-1.amazonaws.com/dev';
};

/**
 * Get API token from URL parameters
 */
export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

/**
 * Get project ID from URL parameters
 */
export function getProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('project_id');
}

/**
 * Get requisition IDs from URL parameters (comma-separated)
 */
export function getRequisitionIds(): string[] {
  if (typeof window === 'undefined') return [];
  const urlParams = new URLSearchParams(window.location.search);
  const raw = urlParams.get('requisition_ids');
  if (!raw) return [];
  return raw.split(',').map((id) => id.trim()).filter(Boolean);
}

/**
 * Generic API request handler with authentication, timeout, and retry logic
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & {
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    skipSuccessCheck?: boolean;
  } = {}
): Promise<T> {
  const token = getAuthToken();

  if (!token) {
    throw new Error('Authentication token not found. Please provide token in URL.');
  }

  const { timeoutMs = 45000, maxRetries = 3, retryDelayMs = 1000, skipSuccessCheck = false, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...fetchOptions.headers,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      if (attempt > 0) {
        const delay = retryDelayMs * Math.pow(2, attempt - 1); // exponential backoff
        console.log(`[API] Retry ${attempt}/${maxRetries} for ${endpoint} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        // Rate limited — wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        console.warn(`[API] Rate limited on ${endpoint}, waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        lastError = new Error(`Rate limited (429)`);
        continue;
      }

      if (response.status >= 500 && attempt < maxRetries) {
        // Server error — retry
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        console.warn(`[API] Server error ${response.status} on ${endpoint}, will retry...`);
        continue;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!skipSuccessCheck && !data.success) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        lastError = new Error(`Request timed out after ${timeoutMs}ms: ${endpoint}`);
        console.warn(`[API] Timeout on ${endpoint} (attempt ${attempt + 1}/${maxRetries + 1})`);
        if (attempt < maxRetries) continue;
        throw lastError;
      }

      // Network errors are retryable
      if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed to fetch')) {
        lastError = error;
        console.warn(`[API] Network error on ${endpoint} (attempt ${attempt + 1}/${maxRetries + 1}):`, error.message);
        if (attempt < maxRetries) continue;
      }

      throw error;
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries + 1} attempts: ${endpoint}`);
}

// ============================================================================
// Requisition Item Types
// ============================================================================

export interface RequisitionItemAttribute {
  attribute_id: string;
  attribute_name: string;
  attribute_type: string;
  attribute_values: Array<{
    value: string | number;
    measurement_unit?: {
      measurement_unit_primary_name: string;
      measurement_unit_abbreviation: string;
    } | null;
  }>;
}

export interface RequisitionItem {
  // IDs needed for sending data back to Factwise
  requisition_item_id: string;
  requisition: string; // requisition UUID (FK)

  // Item info
  item_information: {
    item_id: string;
    item_name: string;
    item_code: string;
    custom_item_name?: string;
    item_description?: string;
    item_additional_details?: string;
    ERP_item_code?: string;
    MPN_item_code?: string;
    CPN_item_code?: string;
    HSN_item_code?: string;
    custom_ids?: Array<{ name: string; value: string }>;
  };

  // Quantity
  quantity: string;
  measurement_unit_details: {
    measurement_unit_name: string;
    measurement_unit_abbreviation: string;
  } | null;

  // Pricing
  pricing_information: {
    desired_price?: string | number | null;
    currency_code_abbreviation?: string;
    currency_symbol?: string;
    total_price?: string | number | null;
  };

  // Specs / attributes
  attributes: RequisitionItemAttribute[];

  // Tags (for auto-assign matching)
  tags: string[];

  // For assignment write-back
  custom_requisition_id?: string;
}

export interface RequisitionItemsResponse {
  data: RequisitionItem[];
  metadata: {
    total: number;
    page: number;
    per_page: number;
  };
  counts: {
    all: number;
  };
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface ProjectOverview {
  success: boolean;
  project: {
    project_id: string;
    project_code: string;
    project_name: string;
    customer_name: string;
    buyer_entity_name: string;
    deadline: string | null;
    validity_from: string | null;
    status: string;
    description: string;
    tags: string[];
  };
  summary: {
    total_items: number;
    items_with_assigned_users: number;
    items_without_assigned_users: number;
    total_quantity: number;
    total_amount: number;
    average_rate: number;
  };
}

export interface ProjectItem {
  project_item_id: string;
  item_code: string;
  item_name: string;
  description: string;
  erp_item_code: string;
  quantity: number;
  rate: number;
  amount: number;
  event_quantity: number | null;
  bom_slab_quantity: number;
  measurement_unit: {
    id: string;
    name: string;
    abbreviation: string;
    category: string;
    value_type: string;
  } | null;
  currency: {
    id: string;
    code: string;
    symbol: string;
    name: string;
  } | null;
  tags: string[];
  custom_tags: string[];
  item_type: string | null;
  status: string | null;
  custom_ids: any;
  custom_fields: any;
  additional_details: any;
  attributes: Array<{
    attribute_id: string;
    attribute_name: string;
    attribute_type: string;
    attribute_values: Array<{
      value: string;
      currency_id?: string;
      measurement_unit_id?: string;
    }>;
  }>;
  buyer_pricing_information: any;
  seller_pricing_information: any;
  notes: string;
  assigned_users: Array<{
    user_id: string;
    email: string;
    name: string;
  }>;
  assigned_users_count: number;
  delivery_schedules: Array<{
    delivery_schedule_id: string;
    quantity: number;
    delivery_date: string | null;
  }>;
  rfq_events_count: number;
  item_valid: boolean;
  created_datetime: string;
  modified_datetime: string;
  created_by_user_id: string | null;
  modified_by_user_id: string | null;
  project_id: string;
  enterprise_item_id: string | null;
  bom_info: {
    is_bom_item: boolean;
    bom_id: string | null;
    bom_code: string | null;
    bom_name: string | null;
    bom_item_id: string | null;
    bom_module_linkage_id: string | null;
    bom_quantity?: number | null;
    bom_item_ratio?: number | null;
    bom_slab_quantity?: number | null;
    bom_measurement_unit?: string | null;
    // NEW: Full hierarchy support
    bom_hierarchy?: Array<{
      bom_id: string;
      bom_code: string;
      bom_name: string;
      level: number;
    }>;
    bom_level?: number;
    root_bom_id?: string | null;
    parent_sub_bom_item_id?: string | null;
    has_sub_bom?: boolean;
    sub_bom_id?: string | null;
  };
  // BOM usages with quantities and delivery slabs
  bom_usages?: Array<{
    bom_id: string;
    bom_code: string;
    bom_name: string;
    bom_quantity: number;
    bom_item_ratio?: number;
    bom_slab_quantity?: number;
    bom_measurement_unit?: string;
    delivery_schedule_item_quantity?: number;
    delivery_date?: string | null;
    bom_hierarchy?: Array<{
      bom_id: string;
      bom_code: string;
      bom_name: string;
      level: number;
    }>;
    bom_level?: number;
  }>;
  // Event usages (RFQ/PO) with quantities
  event_usages?: Array<{
    event_id: string;
    event_code: string;
    event_name?: string;
    event_type: 'RFQ' | 'PurchaseOrder';
    event_quantity: number;
    rfq_entry_id?: string;
    rfq_item_entry_id?: string;
    rfq_status?: string;
    purchase_order_id?: string;
    purchase_order_item_id?: string;
    po_status?: string;
    delivery_schedule_item_quantity?: number;
    delivery_date?: string | null;
    from_bom?: boolean;
    bom_quantity?: number;
    bom_item_ratio?: number;
    bom_slab_quantity?: number;
    bom_module_linkage_id?: string;
  }>;
  // Delivery slabs
  delivery_slabs?: Array<{
    delivery_schedule_item_id: string;
    quantity: number;
    delivery_date: string;
    has_bom: boolean;
    has_event: boolean;
  }>;
  // NEW: Specifications support
  specifications?: Array<{
    spec_id: string;
    spec_name: string;
    spec_type: string;
    spec_values: string[];
  }>;
  // NEW: Digikey pricing support
  digikey_pricing?: DigikeyPricing | null;
  // NEW: Mouser pricing support
  mouser_pricing?: MouserPricing | null;
  // NEW: Alternate item information
  alternate_info?: {
    is_alternate: boolean;
    alternate_parent_id: string | null;
    alternate_parent_name: string | null;
    alternate_parent_code: string | null;
    has_alternates: boolean;
    alternates: Array<{
      item_id: string;
      item_code: string | null;
      item_name: string | null;
    }>;
  };
  // NEW: Custom Identifications (e.g., Manufacturer Part Number, Vendor Code)
  custom_identifications?: Array<{
    identification_id: string;
    identification_name: string;
    identification_type: string;
    identification_value: string;
  }>;
  // NEW: Internal notes field
  internal_notes?: string | null;
}

// Digikey Pricing Interfaces
export interface DigikeyPricing {
  unit_price: number | null;
  currency: string;
  stock: number | null;
  manufacturer: string | null;
  digikey_part_number?: string | null;
  cached_at: string;
  is_stale: boolean;
  source: 'cache' | 'live';
  // Quantity-based pricing fields
  quantity_price?: number | null;
  quantity_tier?: number | null;
  item_quantity?: number | null;
  price_breaks?: Array<{
    quantity: number;
    price: number | string;
  }>;
  savings_info?: {
    base_price: number;
    current_price: number;
    savings_per_unit: number;
    total_savings: number;
    discount_percent: number;
  };
  next_tier_info?: {
    next_tier_qty: number;
    next_tier_price: number;
    additional_qty_needed: number;
    savings_per_unit: number;
    potential_total_savings: number;
  };
}

// Mouser Pricing Interfaces
export interface MouserPricing {
  unit_price: number | null;
  currency: string; // Always "USD"
  stock: number | null;
  manufacturer: string | null;
  mouser_part_number?: string | null;
  lifecycle_status?: string | null;
  category?: string | null;
  datasheet_url?: string | null;
  product_url?: string | null;
  price_breaks?: Array<{
    quantity: number;
    price: number | string;
  }>;
  cached_at: string;
  is_stale: boolean;
  source: 'cache' | 'live';
  // Quantity-based pricing fields
  quantity_price?: number | null;
  quantity_tier?: number | null;
  item_quantity?: number | null;
  savings_info?: {
    base_price: number;
    current_price: number;
    savings_per_unit: number;
    total_savings: number;
    discount_percent: number;
  };
  next_tier_info?: {
    next_tier_qty: number;
    next_tier_price: number;
    additional_qty_needed: number;
    savings_per_unit: number;
    potential_total_savings: number;
  };
}

export interface ProjectItemsResponse {
  success: boolean;
  items: ProjectItem[];
  total: number;
  page: number;
  limit: number;
  // Exchange rates for currency conversion (USD_TO_XXX format)
  exchange_rates?: Record<string, number>;
  // Digikey status fields
  digikey_status?: 'all_cached' | 'background_job_started' | 'not_configured';
  digikey_uncached_count?: number;
  digikey_job_id?: string;
  digikey_estimated_duration_seconds?: number;
  // Mouser status fields
  mouser_status?: 'all_cached' | 'background_job_started' | 'not_configured';
  mouser_uncached_count?: number;
  mouser_job_id?: string;
  mouser_estimated_duration_seconds?: number;
  // Dynamic column name for internal notes (from Item Directory template)
  internal_notes_column_name?: string;
  // Legacy fields (for backward compatibility)
  uncached_count?: number;
  job_id?: string;
  estimated_duration_seconds?: number;
  message?: string;
}

// Digikey Job Status Interface
export interface DigikeyJobStatus {
  success: boolean;
  job: {
    job_id: string;
    status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
    progress_percentage: number;
    total_items: number;
    processed_items: number;
    successful_items: number;
    failed_items: number;
    current_batch?: number;
    total_batches?: number;
    started_at?: string;
    completed_at?: string;
    estimated_completion?: string;
    error_message?: string;
  };
}

export interface ProjectUser {
  user_id: string;
  email: string;
  name: string;
  role: string;
}

export interface ProjectUsersResponse {
  success: boolean;
  users: ProjectUser[];
  project_managers?: ProjectUser[];
  rfq_responsible_users?: ProjectUser[];
  quote_responsible_users?: ProjectUser[];
  available_users?: ProjectUser[];
  total: number;
}

export interface Vendor {
  vendor_id: string;
  vendor_name: string;
  vendor_code: string;
  contact_email: string;
  contact_phone: string;
  is_preferred: boolean;
  active: boolean;
}

export interface VendorsResponse {
  success: boolean;
  vendors: Vendor[];
  total: number;
  limit: number;
  offset: number;
}

export interface Category {
  category_id: string;
  category_name: string;
  category_code: string;
  color: string;
  item_count: number;
}

export interface CategoriesResponse {
  success: boolean;
  categories: Category[];
  total: number;
}

export interface UpdateItemRequest {
  rate?: number;
  quantity?: number;
  notes?: string;
  custom_fields?: Record<string, any>;
  assigned_user_ids?: string[];
}

export interface UpdateItemResponse {
  success: boolean;
  message: string;
  item: ProjectItem;
}

export interface BulkAssignRequest {
  assignments: Array<{
    project_item_id: string;
    user_ids: string[];
    action: 'replace' | 'add' | 'remove';
  }>;
}

export interface BulkAssignResponse {
  success: boolean;
  updated: number;
  failed: number;
  errors: Array<{
    project_item_id: string;
    error: string;
  }>;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get project overview and summary statistics
 */
export async function getProjectOverview(projectId: string): Promise<ProjectOverview> {
  return apiRequest<ProjectOverview>(
    `/organization/project/${projectId}/strategy/overview/`
  );
}

/**
 * Get all items in a project
 */
export async function getProjectItems(
  projectId: string,
  options?: {
    limit?: number;
    offset?: number;
    search?: string;
    has_user?: boolean;
    skip_pricing_jobs?: boolean; // Don't trigger Digikey/Mouser jobs
  }
): Promise<ProjectItemsResponse> {
  const params = new URLSearchParams();

  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());
  if (options?.search) params.append('search', options.search);
  if (options?.has_user !== undefined) params.append('has_user', options.has_user.toString());
  if (options?.skip_pricing_jobs) params.append('skip_pricing_jobs', 'true');

  const queryString = params.toString();
  const endpoint = `/organization/project/${projectId}/strategy/items/${queryString ? '?' + queryString : ''}`;

  return apiRequest<ProjectItemsResponse>(endpoint);
}

/**
 * Update a project item
 */
export async function updateProjectItem(
  projectId: string,
  itemId: string,
  updates: UpdateItemRequest
): Promise<UpdateItemResponse> {
  return apiRequest<UpdateItemResponse>(
    `/organization/project/${projectId}/strategy/items/${itemId}/`,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }
  );
}

/**
 * Get users who have access to the project
 */
export async function getProjectUsers(projectId: string): Promise<ProjectUsersResponse> {
  return apiRequest<ProjectUsersResponse>(
    `/organization/project/${projectId}/strategy/users/`
  );
}

/**
 * Bulk assign users to items
 */
export async function bulkAssignUsers(
  projectId: string,
  assignments: BulkAssignRequest['assignments']
): Promise<BulkAssignResponse> {
  return apiRequest<BulkAssignResponse>(
    `/organization/project/${projectId}/strategy/bulk-assign/`,
    {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    }
  );
}

/**
 * Get list of vendors
 */
export async function getVendors(
  projectId: string,
  options?: {
    search?: string;
    limit?: number;
    offset?: number;
  }
): Promise<VendorsResponse> {
  const params = new URLSearchParams();

  if (options?.search) params.append('search', options.search);
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.offset) params.append('offset', options.offset.toString());

  const queryString = params.toString();
  const endpoint = `/organization/project/${projectId}/strategy/vendors/${queryString ? '?' + queryString : ''}`;

  return apiRequest<VendorsResponse>(endpoint);
}

/**
 * Get list of categories/tags
 */
export async function getCategories(projectId: string): Promise<CategoriesResponse> {
  return apiRequest<CategoriesResponse>(
    `/organization/project/${projectId}/strategy/categories/`
  );
}

// ============================================================================
// PostMessage Communication with Factwise Parent
// ============================================================================

export type FactwiseMessage =
  | { type: 'ITEM_UPDATED'; item_id: string; changes: UpdateItemRequest }
  | { type: 'ITEMS_ASSIGNED'; item_ids: string[]; user_ids: string[] }
  | { type: 'DASHBOARD_READY' }
  | { type: 'REQUEST_REFETCH' };

/**
 * Send message to Factwise parent window
 */
export function sendMessageToFactwise(message: FactwiseMessage) {
  if (typeof window === 'undefined' || window.parent === window) {
    console.log('Not in iframe, skipping postMessage:', message);
    return;
  }

  // Send to parent (Factwise)
  window.parent.postMessage(message, '*');
  console.log('Sent message to Factwise:', message);
}

/**
 * Listen for messages from Factwise parent window
 */
export function listenToFactwiseMessages(
  callback: (message: any) => void
) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: MessageEvent) => {
    // In production, verify origin
    // if (event.origin !== 'https://factwise.io') return;

    console.log('Received message from Factwise:', event.data);
    callback(event.data);
  };

  window.addEventListener('message', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handler);
  };
}

/**
 * Notify Factwise that an item was updated
 */
export function notifyItemUpdated(itemId: string, changes: UpdateItemRequest) {
  sendMessageToFactwise({
    type: 'ITEM_UPDATED',
    item_id: itemId,
    changes,
  });
}

/**
 * Notify Factwise that users were assigned
 */
export function notifyItemsAssigned(itemIds: string[], userIds: string[]) {
  sendMessageToFactwise({
    type: 'ITEMS_ASSIGNED',
    item_ids: itemIds,
    user_ids: userIds,
  });
}

/**
 * Notify Factwise to refetch data
 */
export function requestFactwiseRefetch() {
  sendMessageToFactwise({
    type: 'REQUEST_REFETCH',
  });
}

// ============================================================================
// Additional API Functions for User Assignment
// ============================================================================

/**
 * Auto-assign users to items based on tag-to-user mapping
 */
export async function autoAssignUsersByTags(
  projectId: string,
  tagUserMap: Record<string, string[]>,
  scope: 'all' | 'unassigned' | 'item_ids',
  itemIds?: string[]
): Promise<{
  success: boolean;
  updated: number;
  skipped: number;
  total_assignments: number;
  message: string;
}> {
  const body: any = {
    tag_user_map: tagUserMap,
    scope,
  };

  if (scope === 'item_ids' && itemIds) {
    body.item_ids = itemIds;
  }

  return apiRequest(
    `/organization/project/${projectId}/strategy/auto-assign-by-tags/`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

/**
 * Get available tags for organization (ALL enterprise-level tags)
 */
export async function getProjectTags(projectId: string): Promise<{
  success: boolean;
  tags: string[];
  total: number;
}> {
  return apiRequest(`/organization/project/${projectId}/strategy/tags/`);
}

/**
 * Update tags on a project item
 */
export async function updateItemTags(
  projectId: string,
  itemId: string,
  tags?: string[],
  customTags?: string[]
): Promise<{
  success: boolean;
  project_item_id: string;
  tags: string[];
  custom_tags: string[];
  modified_datetime: string;
  message: string;
}> {
  const body: any = {};

  if (tags !== undefined) {
    body.tags = tags;
  }

  if (customTags !== undefined) {
    body.custom_tags = customTags;
  }

  console.log('[updateItemTags] Request body:', JSON.stringify(body, null, 2));

  return apiRequest(
    `/organization/project/${projectId}/item/${itemId}/tags/`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );
}

// ============================================================================
// Digikey Pricing API Functions
// ============================================================================

/**
 * Get Digikey job status
 */
export async function getDigikeyJobStatus(
  projectId: string,
  jobId: string
): Promise<DigikeyJobStatus> {
  return apiRequest(
    `/organization/project/${projectId}/strategy/digikey/job/${jobId}/`
  );
}

/**
 * Get latest Digikey job for project
 */
export async function getLatestDigikeyJob(
  projectId: string
): Promise<DigikeyJobStatus> {
  return apiRequest(
    `/organization/project/${projectId}/strategy/digikey/job/latest/`
  );
}

/**
 * Get Mouser job status
 */
export async function getMouserJobStatus(
  projectId: string,
  jobId: string
): Promise<DigikeyJobStatus> { // Same interface structure
  return apiRequest(
    `/organization/project/${projectId}/strategy/mouser/job/${jobId}/`
  );
}

/**
 * Get latest Mouser job for project
 */
export async function getLatestMouserJob(
  projectId: string
): Promise<DigikeyJobStatus> { // Same interface structure
  return apiRequest(
    `/organization/project/${projectId}/strategy/mouser/job/latest/`
  );
}

/**
 * Manually trigger Digikey pricing job for all items
 */
export async function triggerDigikeyPricing(
  projectId: string
): Promise<DigikeyJobStatus> {
  return apiRequest(
    `/organization/project/${projectId}/strategy/digikey/fetch/`,
    {
      method: 'POST'
    }
  );
}

/**
 * Manually trigger Mouser pricing job for all items
 */
export async function triggerMouserPricing(
  projectId: string
): Promise<DigikeyJobStatus> { // Same interface structure
  return apiRequest(
    `/organization/project/${projectId}/strategy/mouser/fetch/`,
    {
      method: 'POST'
    }
  );
}

// ============================================================================
// Requisition Items API
// ============================================================================

/**
 * Fetch all items across selected requisitions using the dashboard API.
 * Uses dashboard_view: "inbound_requisition_items" with requisition_id_list.
 */
export async function getRequisitionItems(
  requisitionIds: string[],
  options: {
    page?: number;
    itemsPerPage?: number;
    searchText?: string;
  } = {}
): Promise<RequisitionItemsResponse> {
  const { page = 1, itemsPerPage = 100, searchText = '' } = options;

  return apiRequest<RequisitionItemsResponse>('/dashboard/', {
    method: 'POST',
    body: JSON.stringify({
      dashboard_view: 'inbound_requisition_items',
      tab: 'all',
      sort_fields: [{ field: 'created_datetime', ascending: true }],
      search_text: searchText,
      items_per_page: itemsPerPage,
      page_number: page,
      query_data: {
        requisition_id_list: requisitionIds,
      },
    }),
    // Dashboard API does not return a top-level `success` field
    skipSuccessCheck: true,
  });
}
