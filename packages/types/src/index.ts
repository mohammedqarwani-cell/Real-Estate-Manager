// ============================================================
// DATABASE ENUMS
// ============================================================

export type UserRole = 'admin' | 'manager' | 'accountant' | 'maintenance' | 'receptionist'

export type EmployeeStatus = 'active' | 'inactive'

export type SubscriptionPlan   = 'free' | 'pro' | 'enterprise'
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled'

export type PropertyType = 'residential' | 'commercial' | 'business_center' | 'mixed'
export type PropertyStatus = 'active' | 'inactive' | 'under_maintenance'

export type UnitType = 'apartment' | 'office' | 'retail' | 'studio' | 'villa' | 'warehouse'
export type UnitStatus = 'available' | 'occupied' | 'maintenance' | 'reserved'

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated' | 'renewed'
export type PaymentCycle = 'monthly' | 'quarterly' | 'annually'

export type InvoiceType = 'rent' | 'maintenance' | 'utility' | 'deposit' | 'other'
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'partial'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'online'

export type MaintenanceCategory = 'plumbing' | 'electrical' | 'hvac' | 'structural' | 'cleaning' | 'other'
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent'
export type MaintenanceStatus = 'open' | 'in_progress' | 'completed' | 'cancelled'

export type MeetingRoomStatus = 'available' | 'unavailable' | 'maintenance'
export type BookingType = 'hourly' | 'half_day' | 'full_day'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

export type TenantStatus = 'active' | 'inactive' | 'blacklisted'

export type NotificationType =
  | 'overdue_invoice'
  | 'expiring_contract'
  | 'new_maintenance'
  | 'new_booking'

export type NotificationEntityType = 'invoice' | 'contract' | 'maintenance' | 'booking'

// ============================================================
// DATABASE MODELS (mirrors Supabase tables)
// ============================================================

export interface Company {
  id: string
  name: string
  slug: string
  logo_url: string | null
  owner_id: string | null
  subscription_plan: SubscriptionPlan
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  max_properties: number | null
  max_units: number | null
  max_users: number | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  role: UserRole
  company_id: string | null
  created_at: string
  updated_at: string
}

export interface Tenant {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  national_id: string | null
  company_name: string | null
  address: string | null
  notes: string | null
  documents: string[] | undefined
  status: TenantStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Property {
  id: string
  name: string
  type: PropertyType
  address: string
  city: string | null
  country: string
  total_units: number
  description: string | null
  amenities: string[]
  images: string[]
  status: PropertyStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Unit {
  id: string
  property_id: string
  unit_number: string
  floor: number | null
  type: UnitType | null
  area: number | null
  bedrooms: number | null
  bathrooms: number | null
  monthly_rent: number | null
  status: UnitStatus
  amenities: string[]
  images: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Contract {
  id: string
  unit_id: string
  tenant_id: string
  start_date: string
  end_date: string
  monthly_rent: number
  security_deposit: number
  payment_day: number
  status: ContractStatus
  payment_cycle: PaymentCycle | undefined
  terms: string | null
  document_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  contract_id: string | null
  tenant_id: string
  unit_id: string | null
  invoice_number: string
  type: InvoiceType
  amount: number
  tax_amount: number
  total_amount: number
  due_date: string
  paid_date: string | null
  status: InvoiceStatus
  payment_method: PaymentMethod | null
  reference_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MaintenanceRequest {
  id: string
  unit_id: string | null
  tenant_id: string | null
  title: string
  description: string | null
  category: MaintenanceCategory | null
  priority: MaintenancePriority
  status: MaintenanceStatus
  assigned_to: string | null
  estimated_cost: number | null
  actual_cost: number | null
  scheduled_date: string | null
  completed_date: string | null
  images: string[]
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MeetingRoom {
  id: string
  property_id: string
  name: string
  capacity: number | null
  hourly_rate: number | null
  half_day_rate: number | null
  full_day_rate: number | null
  amenities: string[]
  images: string[]
  status: MeetingRoomStatus
  description: string | null
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  meeting_room_id: string
  tenant_id: string | null
  booked_by: string | null
  start_time: string
  end_time: string
  booking_type: BookingType
  amount: number | null
  status: BookingStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  company_id: string
  user_id: string | null
  name: string
  email: string
  phone: string | null
  role: UserRole
  status: EmployeeStatus
  invited_by: string | null
  joined_at: string | null
  created_at: string
  updated_at: string
}

export interface EmployeeInvitation {
  id: string
  company_id: string
  employee_id: string
  email: string
  role: UserRole
  token: string
  invited_by: string | null
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  entity_id: string | null
  entity_type: NotificationEntityType | null
  created_at: string
}

// ============================================================
// JOINED / EXTENDED TYPES (with relations)
// ============================================================

export interface UnitWithProperty extends Unit {
  property: Pick<Property, 'id' | 'name' | 'address' | 'type'>
}

export interface ContractWithRelations extends Contract {
  unit: UnitWithProperty
  tenant: Pick<Tenant, 'id' | 'full_name' | 'email' | 'phone'>
}

export interface InvoiceWithRelations extends Invoice {
  tenant: Pick<Tenant, 'id' | 'full_name' | 'email'>
  unit?: Pick<Unit, 'id' | 'unit_number'>
  contract?: Pick<Contract, 'id' | 'start_date' | 'end_date'>
}

export interface MaintenanceWithRelations extends MaintenanceRequest {
  unit?: UnitWithProperty
  tenant?: Pick<Tenant, 'id' | 'full_name' | 'phone'>
  assignee?: Pick<Profile, 'id' | 'full_name'>
}

export interface BookingWithRelations extends Booking {
  meeting_room: MeetingRoom & {
    property: Pick<Property, 'id' | 'name'>
  }
  tenant?: Pick<Tenant, 'id' | 'full_name' | 'phone'>
}

// ============================================================
// FORM / DTO TYPES
// ============================================================

export type CreateTenantDTO = Omit<Tenant, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type UpdateTenantDTO = Partial<CreateTenantDTO>

export type CreatePropertyDTO = Omit<Property, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'total_units'>
export type UpdatePropertyDTO = Partial<CreatePropertyDTO>

export type CreateUnitDTO = Omit<Unit, 'id' | 'created_at' | 'updated_at'>
export type UpdateUnitDTO = Partial<CreateUnitDTO>

export type CreateContractDTO = Omit<Contract, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type UpdateContractDTO = Partial<CreateContractDTO>

export type CreateInvoiceDTO = Omit<Invoice, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'invoice_number'>
export type UpdateInvoiceDTO = Partial<CreateInvoiceDTO>

export type CreateMaintenanceDTO = Omit<MaintenanceRequest, 'id' | 'created_at' | 'updated_at' | 'created_by'>
export type UpdateMaintenanceDTO = Partial<CreateMaintenanceDTO>

export type CreateBookingDTO = Omit<Booking, 'id' | 'created_at' | 'updated_at'>
export type UpdateBookingDTO = Partial<CreateBookingDTO>

// ============================================================
// DASHBOARD / ANALYTICS TYPES
// ============================================================

export interface DashboardStats {
  totalProperties: number
  totalUnits: number
  occupiedUnits: number
  availableUnits: number
  occupancyRate: number
  totalTenants: number
  activeTenants: number
  activeContracts: number
  expiringContracts: number
  monthlyRevenue: number
  pendingInvoices: number
  overdueInvoices: number
  openMaintenanceRequests: number
  todayBookings: number
}

export interface RevenueByMonth {
  month: string
  revenue: number
  invoices: number
}

export interface OccupancyByProperty {
  property_id: string
  property_name: string
  total_units: number
  occupied_units: number
  occupancy_rate: number
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ============================================================
// SUPABASE DATABASE TYPE (for type-safe queries)
// ============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      tenants: {
        Row: Tenant
        Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Tenant, 'id' | 'created_at'>>
      }
      properties: {
        Row: Property
        Insert: Omit<Property, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Property, 'id' | 'created_at'>>
      }
      units: {
        Row: Unit
        Insert: Omit<Unit, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Unit, 'id' | 'created_at'>>
      }
      contracts: {
        Row: Contract
        Insert: Omit<Contract, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Contract, 'id' | 'created_at'>>
      }
      invoices: {
        Row: Invoice
        Insert: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Invoice, 'id' | 'created_at'>>
      }
      maintenance_requests: {
        Row: MaintenanceRequest
        Insert: Omit<MaintenanceRequest, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MaintenanceRequest, 'id' | 'created_at'>>
      }
      meeting_rooms: {
        Row: MeetingRoom
        Insert: Omit<MeetingRoom, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MeetingRoom, 'id' | 'created_at'>>
      }
      bookings: {
        Row: Booking
        Insert: Omit<Booking, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Booking, 'id' | 'created_at'>>
      }
      notifications: {
        Row: Notification
        Insert: Omit<Notification, 'id' | 'created_at'>
        Update: Partial<Pick<Notification, 'read'>>
      }
      employees: {
        Row: Employee
        Insert: Omit<Employee, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Employee, 'id' | 'created_at'>>
      }
      employee_invitations: {
        Row: EmployeeInvitation
        Insert: Omit<EmployeeInvitation, 'id' | 'created_at' | 'token'>
        Update: Partial<Pick<EmployeeInvitation, 'accepted_at'>>
      }
    }
  }
}
