# context.md — توثيق مشروع Real Estate Manager

**آخر تحديث:** 2026-04-29 — تجديد العقود، مسودة العقد، فلاتر متقدمة، تحسينات جدول العقود، تفاصيل وتعديل الفواتير  
**المسار:** `C:\Projects\real-estate-manager\`

---

## 1. نظرة عامة

نظام إدارة عقارات SaaS Multi-tenant (Monorepo) يشمل تطبيق ويب وتطبيق جوال. يُستخدم لإدارة العقارات والوحدات والمستأجرين والعقود والفواتير وطلبات الصيانة وحجوزات قاعات الاجتماعات. كل شركة (tenant) معزولة بياناتها تماماً عبر `company_id` + RLS.

---

## 2. Stack التقني

### البنية العامة

| الطبقة | التقنية | الإصدار |
|---|---|---|
| Monorepo | Turborepo | ^2.3.3 |
| Package Manager | npm workspaces | 10.9.2 |
| اللغة | TypeScript | ^5.7.3 |
| Node.js | — | >=20.0.0 |

### تطبيق الويب (`apps/web`)

| الطبقة | التقنية | الإصدار |
|---|---|---|
| Framework | Next.js (App Router) | 15.2.3 |
| Rendering | React | 19.2.4 |
| Bundler (dev) | Turbopack | مدمج مع Next.js |
| Styling | Tailwind CSS | ^3.4.17 |
| Tailwind Animations | tailwindcss-animate | مثبّت |
| UI Primitives | Radix UI | مكونات متعددة |
| Icons | Lucide React | ^0.468.0 |
| Forms | React Hook Form + Zod | ^7.54.2 / ^3.24.1 |
| Charts | Recharts | ^2.14.1 |
| Table | TanStack Table | ^8.21.3 |
| Toasts | Sonner | ^1.7.2 |
| Date Utils | date-fns | ^4.1.0 |
| Class Utils | clsx + tailwind-merge + CVA | — |
| Auth + DB | Supabase (SSR) | ^0.5.2 |

### تطبيق الجوال (`apps/mobile`)

| الطبقة | التقنية |
|---|---|
| Framework | Expo (React Native) |
| Routing | Expo Router |

### الباك إند والقاعدة (`supabase/`)

| الطبقة | التقنية |
|---|---|
| Database | PostgreSQL (عبر Supabase) |
| Auth | Supabase Auth |
| RLS | Row Level Security |
| Storage | Supabase Storage (bucket: property-images — public) |
| Migrations | SQL يدوي |

---

## 3. هيكل المشروع

```
real-estate-manager/
├── apps/
│   ├── web/                        # Next.js 15 App Router
│   │   ├── app/
│   │   │   ├── (auth)/login/
│   │   │   │   ├── page.tsx        # صفحة تسجيل الدخول (useActionState)
│   │   │   │   └── actions.ts      # loginAction — Server Action محمي من CSRF
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx      # يجلب profile + expiringCount + overdueCount + openMaintenanceCount
│   │   │   │   └── dashboard/
│   │   │   │       ├── page.tsx          # لوحة التحكم الرئيسية
│   │   │   │       ├── bookings/         # الحجوزات
│   │   │   │       ├── contracts/        # العقود
│   │   │   │       ├── invoices/         # الفواتير
│   │   │   │       ├── maintenance/      # الصيانة
│   │   │   │       │   ├── page.tsx      # Server Component — 5 استعلامات متوازية + إحصائيات
│   │   │   │       │   └── actions.ts    # createMaintenanceRequest, updateMaintenanceRequest
│   │   │   │       ├── properties/
│   │   │   │       │   ├── page.tsx      # Server Component — يمرر البيانات للـ Client
│   │   │   │       │   ├── actions.ts    # createProperty, updateProperty, deleteProperty
│   │   │   │       │   └── [id]/
│   │   │   │       │       ├── page.tsx  # تفاصيل العقار + إحصائيات + رابط "إدارة الوحدات"
│   │   │   │       │       └── units/
│   │   │   │       │           ├── page.tsx   # Server Component — وحدات + عقود + صيانة
│   │   │   │       │           └── actions.ts # createUnit, updateUnit, updateUnitStatus
│   │   │   │       └── tenants/          # المستأجرون
│   │   │   ├── globals.css
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   └── Sidebar.tsx
│   │   │   ├── properties/
│   │   │   │   ├── PropertiesClient.tsx    # Grid + فلترة + بحث + قائمة تعديل/حذف
│   │   │   │   ├── PropertyFormDialog.tsx  # Dialog إضافة/تعديل (RHF + Zod)
│   │   │   │   └── PropertyDetailClient.tsx # زر التعديل في صفحة التفاصيل
│   │   │   ├── units/
│   │   │   │   ├── UnitsClient.tsx         # TanStack Table + فلترة + sort + inline status
│   │   │   │   ├── UnitFormDialog.tsx      # Dialog إضافة/تعديل + صور متعددة
│   │   │   │   ├── UnitDetailDialog.tsx    # بطاقة التفاصيل الكاملة
│   │   │   │   └── OccupancyWidget.tsx     # Donut chart + إيرادات الشهر
│   │   │   ├── invoices/
│   │   │   │   ├── InvoicesClient.tsx      # جدول + period tabs + بحث + فلترة + توليد جداول دفعات + أزرار تفاصيل/تعديل
│   │   │   │   ├── InvoiceFormDialog.tsx   # Dialog إنشاء + تعديل فاتورة (وضع مزدوج create/edit)
│   │   │   │   ├── InvoiceDetailDialog.tsx # Dialog عرض تفاصيل الفاتورة الكاملة (قراءة فقط)
│   │   │   │   ├── PaymentDialog.tsx       # Dialog تسجيل دفعة (مبلغ+طريقة+رقم مرجعي)
│   │   │   │   └── FinancialOverview.tsx   # 4 KPI cards + Bar chart Recharts + أكثر المتأخرين
│   │   │   ├── maintenance/
│   │   │   │   ├── MaintenanceClient.tsx   # جدول + Kanban + فلاتر + Supabase Realtime
│   │   │   │   ├── MaintenanceRequestDialog.tsx # Dialog رفع طلب + رفع صور
│   │   │   │   ├── UpdateStatusDialog.tsx  # Dialog تحديث الحالة + تعيين فني + تكلفة
│   │   │   │   └── MaintenanceStats.tsx    # 4 KPI cards + Pie chart Recharts
│   │   │   └── ui/                         # shadcn-style components
│   │   │       ├── button.tsx
│   │   │       ├── dialog.tsx
│   │   │       ├── input.tsx
│   │   │       ├── label.tsx
│   │   │       ├── select.tsx
│   │   │       └── textarea.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── lib/
│   │   │   ├── utils.ts            # cn() helper
│   │   │   └── supabase/
│   │   │       ├── client.ts
│   │   │       ├── server.ts
│   │   │       └── middleware.ts
│   │   ├── middleware.ts
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── .env.local
│   │
│   └── mobile/                     # Expo React Native (هيكل فارغ)
│
├── packages/
│   ├── types/                      # @repo/types
│   │   └── src/index.ts
│   └── ui/                         # @repo/ui
│       └── src/components/
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_rls_policies.sql
│   │   ├── 003_add_payment_cycle_and_tenant_documents.sql
│   │   ├── 004_fix_rls_auth_users_access.sql
│   │   ├── 005_invoices_enhancements.sql
│   │   ├── 006_fix_invoices_select_policy.sql
│   │   ├── 007_maintenance_realtime.sql
│   │   ├── 008_notifications.sql
│   │   ├── 009_..._010_...
│   │   ├── 011_add_company_id_to_invoices.sql
│   │   ├── 012_fix_generate_monthly_invoices_v3.sql
│   │   ├── 013_generate_contract_invoices.sql  # full schedule for any cycle
│   │   └── 014_add_contract_type.sql           # NEW: contract_type (full_time | part_time)
│   └── seed.sql
│
├── turbo.json
├── package.json
└── prettier.config.mjs
```

---

## 4. جداول قاعدة البيانات

### الجداول المُنشأة (Migration 001)

| الجدول | الغرض | الحقول الرئيسية |
|---|---|---|
| `profiles` | يمتد `auth.users` بمعلومات المستخدم | `id, full_name, phone, role` |
| `tenants` | المستأجرون | `full_name, email, phone, national_id, company_name, status` |
| `properties` | العقارات | `name, type, address, total_units, amenities, images, status` |
| `units` | وحدات داخل العقارات | `property_id, unit_number, type, area, monthly_rent, status, images` |
| `contracts` | عقود الإيجار | `unit_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, payment_day, contract_type` |
| `invoices` | الفواتير | `invoice_number, type, amount, tax_amount, total_amount, due_date, paid_date, status, payment_method, reference_number` |
| `maintenance_requests` | طلبات الصيانة | `unit_id, tenant_id, title, category, priority, status, assigned_to` |
| `meeting_rooms` | قاعات الاجتماعات | `property_id, name, capacity, hourly_rate, half_day_rate, full_day_rate` |
| `bookings` | حجوزات قاعات الاجتماعات | `meeting_room_id, tenant_id, start_time, end_time, booking_type, amount` |

### الـ Triggers الأتوماتيكية

| الـ Trigger | الجدول | الوظيفة |
|---|---|---|
| `on_auth_user_created` | `auth.users` | يُنشئ `profile` تلقائياً عند تسجيل مستخدم جديد |
| `sync_units_count` | `units` | يُحدّث `properties.total_units` عند إضافة/حذف وحدة |
| `sync_contract_to_unit` | `contracts` | يُغيّر `units.status` إلى `occupied/available` تبعاً للعقد |
| `maintenance_set_completed_date` | `maintenance_requests` | يُسجّل `completed_date` عند تغيير الحالة لـ `completed` |
| `prevent_booking_overlap` | `bookings` | يمنع تداخل الحجوزات لنفس القاعة |
| `*_updated_at` (جميع الجداول) | كل الجداول | يُحدّث `updated_at` تلقائياً عند أي تعديل |

### نظام الصلاحيات (RLS — Migration 002)

| الدور | الصلاحيات |
|---|---|
| `admin` | قراءة + كتابة + حذف كامل على جميع الجداول |
| `manager` | قراءة + كتابة على جميع الجداول (بدون حذف) |
| `accountant` | قراءة + كتابة على الفواتير فقط |
| `maintenance` | قراءة + كتابة على طلبات الصيانة فقط |

### دوال مساعدة في DB

```sql
get_user_role()                        -- يُرجع دور المستخدم الحالي
is_admin_or_manager()                  -- Boolean للتحقق من الصلاحية
is_admin()                             -- Boolean للتحقق من دور admin فقط
can_access_invoices()                  -- Boolean: admin أو manager أو accountant (Migration 006)
get_auth_user_email()                  -- SECURITY DEFINER: يقرأ auth.users بأمان (Migration 004)
can_access_maintenance()               -- Boolean: admin أو manager أو maintenance (Migration 007)
mark_overdue_invoices()                -- يُحوّل الفواتير المتأخرة لـ overdue
generate_monthly_invoices(year, month) -- يُولّد فواتير شهرية فقط (Migration 005 — قديم، يُبقى للتوافق)
generate_contract_invoices(uuid)       -- يُولّد جدول دفعات كامل لعقد واحد (Migration 013)
                                       --   يدعم: سنوي (1) / نصف سنوي (2) / ربعي (4) / شهري (12)
                                       --   المبلغ: payment_amount > total_amount/n > monthly_rent*12/n
                                       --   idempotent: يتخطى الأشهر الموجودة مسبقاً
generate_all_invoices()                -- يُولّد جداول دفعات لجميع العقود الفعّالة (Migration 013)
```

---

## 5. Supabase Storage

| البكت | الحالة | الاستخدام |
|---|---|---|
| `property-images` | موجود — Public | صور العقارات وصور الوحدات **وصور الصيانة** |

### طريقة الرفع
- يتم الرفع من **Server Actions** فقط باستخدام `createClient` المباشر من `@supabase/supabase-js` مع `SUPABASE_SERVICE_ROLE_KEY`.
- **لا يُستخدم** SSR client للـ Storage لأنه غير مناسب لعمليات الرفع.
- صور العقارات تُخزَّن في مسار: `properties/{timestamp}-{random}.{ext}`
- صور الوحدات تُخزَّن في مسار: `units/{timestamp}-{random}.{ext}`
- صور طلبات الصيانة تُخزَّن في مسار: `maintenance/{timestamp}-{random}.{ext}`
- الـ Public URL يُجلب عبر `getPublicUrl()` ويُخزَّن في حقل `images[]`.

### ملاحظة مهمة
```ts
// الطريقة الصحيحة للرفع في Server Actions:
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
// وليس createServerClient() أو createServiceRoleClient()
```

---

## 6. صفحات الـ Dashboard

| المسار | الصفحة | البيانات المُجلبة |
|---|---|---|
| `/dashboard` | لوحة التحكم الرئيسية | 8 استعلامات متوازية (Promise.all) |
| `/dashboard/properties` | إدارة العقارات | Grid + فلترة النوع + بحث + إضافة/تعديل/حذف |
| `/dashboard/properties/[id]` | تفاصيل العقار | بيانات العقار + قائمة الوحدات + 4 إحصائيات إشغال |
| `/dashboard/properties/[id]/units` | إدارة وحدات العقار | TanStack Table + فلترة + إضافة/تعديل + تفاصيل + Donut chart |
| `/dashboard/tenants` | إدارة المستأجرين | جدول المستأجرين — اسم المستأجر رابط للتفاصيل |
| `/dashboard/tenants/[id]` | تفاصيل المستأجر | tenant + contracts (with unit+property) + آخر 5 invoices — 3 استعلامات متوازية |
| `/dashboard/contracts` | إدارة العقود | جدول العقود |
| `/dashboard/invoices` | الفواتير والمدفوعات | FinancialOverview + Bar chart + جدول فواتير كامل |
| `/dashboard/maintenance` | طلبات الصيانة | MaintenanceStats + MaintenanceClient (جدول + Kanban) |
| `/dashboard/bookings` | حجوزات القاعات | جدول الحجوزات |
| `/dashboard/reports` | التقارير | 4 استعلامات متوازية (paid invoices, units, overdue, bookings) |
| `(auth)/login` | تسجيل الدخول | — |

---

## 7. الباقات المشتركة (Packages)

### `@repo/types`
أنواع TypeScript المشتركة بين الويب والجوال:
- **Database Models:** `Profile, Tenant, Property, Unit, Contract, Invoice, MaintenanceRequest, MeetingRoom, Booking`
- **Joined Types:** `UnitWithProperty, ContractWithRelations, InvoiceWithRelations, ...`
- **DTO Types:** `CreatePropertyDTO, UpdatePropertyDTO, ...` (لكل كيان)
- **Analytics Types:** `DashboardStats, RevenueByMonth, OccupancyByProperty`
- **API Types:** `ApiResponse<T>, PaginatedResponse<T>, PaginationParams`
- **Supabase Database Type:** interface كامل لـ type-safe queries

### `@repo/ui`
مكونات UI مشتركة (مبنية على Tailwind + CVA):
- `Button`, `Card`, `Badge`, `StatCard`

### UI Components في `apps/web/components/ui/`
مكونات shadcn-style مبنية فوق Radix UI (مُنشأة في هذا المشروع):
- `button.tsx` — CVA variants (default, outline, ghost, destructive...)
- `dialog.tsx` — Radix Dialog كامل مع overlay وanimations
- `input.tsx` — Input مع focus ring
- `label.tsx` — Radix Label
- `select.tsx` — Radix Select كامل مع ScrollUp/Down
- `textarea.tsx` — Textarea

### مكونات الوحدات (`apps/web/components/units/`)
- `UnitsClient.tsx` — TanStack Table مع فلترة حسب الحالة + sort + تغيير الحالة inline
- `UnitFormDialog.tsx` — Dialog إضافة/تعديل وحدة مع رفع صور متعددة
- `UnitDetailDialog.tsx` — بطاقة تفاصيل الوحدة (مستأجر حالي + تاريخ عقود + صيانة)
- `OccupancyWidget.tsx` — Recharts Donut chart + نسبة الإشغال + إيرادات الشهر

---

## 8. القرارات التقنية

### 8.1 Monorepo بـ Turborepo
- يُتيح مشاركة الأنواع والمكونات بين الويب والجوال.
- Pipeline مُعرّف في `turbo.json`: `dev → build → lint → type-check`.

### 8.2 Next.js App Router (Server Components)
- صفحات الـ Dashboard هي Server Components تجلب البيانات مباشرة من Supabase.
- لا يوجد `useEffect` لجلب البيانات في الصفحات الرئيسية — كل شيء SSR.
- `Promise.all` لتوازي الاستعلامات (8 في الرئيسية، 2-4 في صفحة الوحدات).

### 8.3 Supabase بدلاً من Custom Backend
- Auth + Database + RLS + Storage في مكان واحد.
- ثلاث طرق للاتصال: `client.ts` (Client Components)، `server.ts` (RSC/Server Actions)، `middleware.ts` (Auth Guard).
- `middleware.ts` في جذر `apps/web` يحمي جميع مسارات `/dashboard/*`.

### 8.4 Row Level Security (RLS)
- الأمان مُطبَّق على مستوى قاعدة البيانات مباشرةً.
- حتى لو تجاوز أحدهم الـ Frontend، القاعدة ترفض الطلب غير المصرح.
- دالة `get_user_role()` بـ `SECURITY DEFINER` لمنع تعديل الـ role من الـ client.

### 8.5 Zod + React Hook Form
- كل نموذج إدخال يمر عبر Zod schema على مستويين: client-side (RHF) + server-side (Server Action).
- يُستخدم `useTransition` + `startTransition` بدل `useActionState` لاستدعاء Server Actions — أكثر استقراراً مع React 19.

### 8.6 الفاتورة — `total_amount` كـ Generated Column
- `total_amount = amount + tax_amount` مُحسوب على مستوى DB.
- لا حاجة لحسابه في الـ Frontend.

### 8.7 ترقيم الفواتير
- `invoice_number` يُولَّد تلقائياً بالصيغة `INV-YYYY-NNNNN` عبر sequence في DB.

### 8.8 tailwind.config.ts
- يشمل `tailwindcss-animate` (مطلوب لـ Dialog animations).
- يشمل ألوان `popover` المطلوبة لـ Select و Dialog.
- `content` يشمل `../../packages/ui/src/**/*.{ts,tsx}` للمكونات المشتركة.

### 8.9 Radix Select — قيمة "غير محدد"
- Radix UI يرفض `value=""` في `<SelectItem>` لأن القيمة الفارغة محجوزة للـ placeholder.
- الحل: استخدام `value="none"` وتحويله إلى `null/undefined` عند الإرسال في `onSubmit`.

### 8.10 العملة
- العملة المستخدمة في المشروع: **الدرهم الإماراتي (د.إ)**
- تنسيق الأرقام: `toLocaleString('ar-AE')`

### 8.11 supabase.rpc — لا تستخدم .catch()
- `supabase.rpc()` يُرجع PromiseLike وليس Promise حقيقي، لذا `.catch()` تُسبب `TypeError`.
- الحل: استخدم `try { await ... } catch { }` بدلاً من `.catch()`.

### 8.12 RLS — policies الفواتير
- الـ policies التي تحتوي على nested join مع `tenants` تُسبب `permission denied for table users` حتى للـ admin.
- الحل (Migration 006): دالة `can_access_invoices()` بـ SECURITY DEFINER تُحدد الصلاحية بشكل مستقل بدون أي JOIN.

### 8.13 أدوار profiles — constraint
- الـ schema الأصلي (Migration 001) يحتوي على `CHECK (role IN ('admin', 'manager', 'staff', 'tenant'))`.
- Migration 006 يُحدّث الـ constraint ليشمل `'accountant'` و`'maintenance'` أيضاً.

### 8.14 Supabase Realtime — نمط آمن مع Dialog
- Realtime مُفعَّل على `maintenance_requests` عبر `ALTER PUBLICATION supabase_realtime ADD TABLE`.
- يُستخدم `dialogOpenRef` لتتبع ما إذا كان أي Dialog مفتوحاً.
- عند استقبال حدث INSERT: يُعرض `toast.info` دائماً، لكن `router.refresh()` لا يُستدعى إلا إذا كانت `dialogOpenRef.current === false`.
- هذا يمنع بق Radix UI الذي يترك `pointer-events: none` على `body` عند `router.refresh()` داخل Realtime subscription بينما Dialog مفتوح.

### 8.15 RLS — maintenance_requests policies
- الـ policies الأصلية (Migration 002) تحتوي على `JOIN auth.users u ON u.email = t.email` في الـ SELECT و UPDATE policies.
- هذا يُسبب `permission denied for table users` (code: 42501) حتى للـ admin — نفس بق الفواتير.
- Migration 007 يُصلح هذا بنفس نهج Migration 006: دالة `can_access_maintenance()` بـ SECURITY DEFINER + إعادة كتابة الـ policies بدون أي JOIN.
- دور `maintenance` لم يكن مدرجاً في `maintenance_select` policy الأصلية — تم إضافته في Migration 007.

### 8.16 profiles query — لا تستعلم بـ role filter من SSR
- استعلام `supabase.from('profiles').select(...).in('role', [...])` قد يفشل إذا كانت RLS profiles تسمح فقط بقراءة الـ profile الخاص.
- الحل: لا تعرض `assignee` كـ joined relation في الـ query الرئيسي — بدلاً من ذلك، جلب `profiles` للـ technicians بشكل منفصل وعمل lookup في الـ client بـ `technicians.find(t => t.id === req.assigned_to)`.
- تجنّب `assignee:profiles!foreign_key_name(...)` في Supabase joins — إذا لم يكن الـ FK constraint موجوداً فعلاً في DB، يُسبب permission errors.

### 8.17 Radix Dialog — DialogDescription مطلوبة
- Radix UI يُصدر warning في console إذا لم يكن `DialogContent` مصحوباً بـ `DialogDescription` أو `aria-describedby`.
- الحل: إضافة `<DialogDescription className="sr-only">وصف مختصر</DialogDescription>` داخل كل `DialogHeader`.

### 8.18 React — مكونات داخلية (Inner Components) Anti-Pattern
- تعريف function components داخل body مكوّن آخر (مثل `function StatsBar() { return ... }` داخل `BookingsPageClient`) يُسبب إعادة mount كاملة عند كل render للـ parent.
- النتيجة: فقدان state الـ dialog (يُفتح ويُغلق فوراً)، تدمير input values، مشاكل في animations.
- الحل: نقل المكونات إلى ملفات منفصلة أو inline كـ JSX مباشرةً داخل `return` باستخدام `{condition && (...)}`.
- النمط المُستخدم في `BookingsPageClient.tsx`: كل JSX مُدمج مباشرةً في الـ return بدون أي inner function components.

### 8.19 DB Trigger — منع تداخل الحجوزات
- يوجد trigger في DB يُسمّى `prevent_booking_overlap` يمنع إنشاء حجزين متداخلين على نفس القاعة.
- إذا حدث تداخل، يُرجع خطأ يحتوي على `"overlap"` — يُكتشف في `createBooking` action:
  ```ts
  if (err.message?.includes('overlap')) return { ..., error: 'هذا الوقت محجوز بالفعل لهذه القاعة' }
  ```

### 8.22 نوع العقد (contract_type) — Migration 014
- عمود `contract_type TEXT NOT NULL DEFAULT 'full_time'` مع `CHECK (contract_type IN ('full_time', 'part_time'))`.
- **الافتراضي في النموذج**: `part_time` (🟡 دوام جزئي).
- **نموذج إنشاء العقد** (`ContractFormDialog`): حقل Select بخيارَين (🔵 دوام كامل / 🟡 دوام جزئي).
- **جدول العقود** (`ContractsClient`): عمود "النوع" بـ badge ملوّن + أزرار فلتر (الكل / دوام كامل / دوام جزئي).
- **صفحة المستأجرين**: فلتر بنوع عقد المستأجر الفعّال — `TenantWithContractCount` يحمل `active_contract_type: string | null`.
- في `@repo/types`: `ContractType = 'full_time' | 'part_time'` + حقل `contract_type: ContractType` في `Contract`.

### 8.23 تجديد العقد
- **زر "تجديد العقد"** يظهر في `ContractDetailClient` عندما يكون العقد `active` أو `expired`.
- **`RenewContractDialog`** (`components/contracts/RenewContractDialog.tsx`):
  - يُحمَّل مسبقاً بـ: تاريخ البداية = نهاية القديم + 1 يوم، النهاية = +سنة، نفس المبلغ/الدفعات/الشروط.
  - جدول دفعات قابل للتعديل (نفس ContractFormDialog).
  - عند التأكيد: العقد القديم → `renewed`، ينشئ عقد جديد `active` + فواتيره، يُعيد التوجيه للعقد الجديد.
- **`renewContract` action** في `contracts/actions.ts`: يستقبل `oldContractId` + FormData — لا يحتاج unit_id/tenant_id (مأخوذان من القديم).
- **`RenewFormState`**: `{ success, error, fieldErrors, newContractId? }`.

### 8.24 مسودة العقد
- نموذج إنشاء العقد يملك زرَّين للإرسال:
  - **"إنشاء العقد"**: يُفعّل العقد (`status: active`) + يُشغّل الوحدة + ينشئ الفواتير.
  - **"حفظ كمسودة"**: يحفظ بـ `status: draft` — الوحدة تبقى `available`، لا فواتير تُنشأ.
- حقل `status` في `contractSchema` و`createContract` action يقبل `'active' | 'draft'`.

### 8.25 تحسينات جدول العقود (ContractsClient)
- **عرض عمود الاسم قابل للسحب**: handle على الحافة اليسرى للعمود فقط (RTL)، حد أدنى 80px.
- **فلاتر متقدمة** (panel قابل للطي بزر "فلاتر متقدمة"):
  - بحث نصي: اسم المستأجر، الشركة، رقم الوحدة، اسم العقار.
  - فلتر الحالة: أزرار (الكل / ساري / منتهي / ملغي / مسودة / مجدد) مع العدد.
  - فلتر العقار + فلتر المستأجر (Select).
  - نوع العقد: أزرار (كل الأنواع / 🔵 كامل / 🟡 جزئي).
  - "تنتهي خلال": أزرار (30 / 60 / 90 يوم) — للعقود الفعّالة.
  - نطاق تاريخ البداية (من/إلى) + نطاق تاريخ النهاية (من/إلى).
  - نطاق المبلغ (من/إلى بالدرهم).
  - زر "مسح الكل" + عداد النتائج.
- **ترتيب بالأعمدة** ↕️: المستأجر، البداية، النهاية، إجمالي الإيجار.
- **Combobox** (`components/ui/combobox.tsx`): نتائج الفلترة مرتّبة أبجدياً — ما يبدأ بالنص أولاً ثم ما يحتويه، `localeCompare('ar')`.
- **تسمية**: "مُنهى" → **"ملغي"** في جميع الملفات (ContractsClient, [id]/page, TenantDetailClient, UnitDetailDialog).
- **تسمية**: "إجمالي الإيجار السنوي" → **"إجمالي الإيجار"** (دعم عقود أطول من سنة).

### 8.26 تفاصيل وتعديل الفواتير

#### عرض التفاصيل (InvoiceDetailDialog)
- **`InvoiceDetailDialog`** (`components/invoices/InvoiceDetailDialog.tsx`): Dialog قراءة فقط يعرض:
  - رقم الفاتورة + badge الحالة في بطاقة علوية.
  - بيانات المستأجر (الاسم، المسؤول إن وُجد، البريد).
  - العقار والوحدة.
  - التفاصيل المالية (المبلغ، الضريبة، الإجمالي مُميَّز بالأخضر).
  - التواريخ وطريقة الدفع.
  - الملاحظات.
- **زر "تفاصيل"** (أيقونة Eye) يظهر عند hover على كل صف في جدول الفواتير.

#### تعديل الفواتير (Edit Mode في InvoiceFormDialog)
- **`InvoiceFormDialog`** أصبح يعمل بوضعَين:
  - **إنشاء** (`invoice` prop = null/undefined): النموذج فارغ + يختار المستأجر والعقد.
  - **تعديل** (`invoice` prop = InvoiceRow): يُملأ النموذج مسبقاً + يظهر اسم المستأجر كـ read-only.
- **حقول التعديل**: النوع، المبلغ، الضريبة، تاريخ الاستحقاق، الحالة (select كامل)، الملاحظات.
- **`updateInvoice` action** (`invoices/actions.ts`): يستقبل `invoiceId` + FormData — يحسب `total_amount = amount + tax_amount` ويُحدّث DB.
- **تعديل الفواتير المدفوعة/الملغاة**: مسموح دائماً مع ظهور بانر تحذير برتقالي:
  > ⚠️ هذه الفاتورة **مدفوعة** — أي تعديل سيؤثر على السجلات المالية.
- **زر "تعديل"** (أيقونة Pencil، أزرق) يظهر عند hover على جميع صفوف الفواتير بدون استثناء.

### 8.21 نظام التقارير وتوليد PDF
- الحزم المُضافة: `@react-pdf/renderer ^3.4.4`, `xlsx ^0.18.5`
- `serverExternalPackages: ['@react-pdf/renderer', 'canvas']` مُضافة في `next.config.ts` لمنع استيراد المكتبة server-side.
- `@react-pdf/renderer` مع React 19: تعارض في أنواع ReactNode — الحل: `children: any` في المكونات الداخلية.
- **توليد PDF**: دائماً عبر `import('@react-pdf/renderer')` الديناميكي + `pdf(<Document />).toBlob()` ثم إنشاء رابط تنزيل مؤقت.
- **Chart Snapshot**: تحويل SVG الـ Recharts إلى PNG عبر `XMLSerializer` + `Canvas API` بدون html2canvas.
- **خط عربي**: Cairo من CDN `@fontsource/cairo` — يستلزم إنترنت. للإنتاج: حمّل Cairo.woff إلى `public/fonts/` وعدّل `fonts.ts`.
- **تصدير Excel**: `xlsx` مع `exportToExcel()` في `lib/excel-export.ts` — تصدير مباشر client-side.
- **صفحة التقارير** (`/dashboard/reports`): 4 تبويبات (مالي / إشغال / متأخرات / قاعات الاجتماع)، كل تبويب: Recharts chart + جدول + Excel + PDF.
- **زر طباعة العقد**: في `ContractDetailClient` — يستقبل `contract?: ContractForPDF` من `[id]/page.tsx`.
- **زر طباعة الفاتورة**: أيقونة Printer تظهر عند hover على صف الفاتورة في `InvoicesClient`.

### 8.20 حساب مبلغ الحجز تلقائياً (Client-side)
- `hourly`: `hours × hourly_rate` (محسوب من الفرق بين start_time و end_time بالمللي ثانية ÷ 3600000)
- `half_day`: `half_day_rate` مباشرةً (مع auto-set لـ end_time = start_time + 4 ساعات)
- `full_day`: `full_day_rate` مباشرةً (مع auto-set لـ end_time = start_time + 8 ساعات)
- النتيجة ترسل في `FormData` كـ `amount` وتُحفظ في DB بدون إعادة حساب.

---

## 9. أوامر التطوير

```bash
# تشغيل الويب فقط (من جذر المشروع)
npm run dev

# حذف الـ cache (PowerShell — من داخل apps/web)
Remove-Item -Path "C:\Projects\real-estate-manager\apps\web\.next" -Recurse -Force

# فحص الأنواع
npm run type-check

# تنسيق الكود
npm run format
```

---

## 10. متغيرات البيئة

**`apps/web/.env.local`** (مطلوبة):
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # مطلوب لرفع الصور على Storage

# Resend (إشعارات البريد)
RESEND_API_KEY=re_xxxx
FROM_EMAIL=noreply@yourdomain.com
APP_NAME="Real Estate Manager"

# Twilio WhatsApp (اختياري)
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## 12. نظام الإشعارات (مكتمل — 2026-04-14)

### الملفات المُنشأة أو المُعدَّلة

| الملف | الحالة | الوصف |
|---|---|---|
| `supabase/migrations/008_notifications.sql` | جديد | جدول notifications + RLS + Realtime + Triggers + دوال DB |
| `packages/types/src/index.ts` | معدَّل | `NotificationType`, `NotificationEntityType`, `Notification` interface + Database type |
| `apps/web/components/notifications/NotificationCenter.tsx` | جديد | Bell icon + badge + Dropdown + Realtime subscription |
| `apps/web/components/layout/Header.tsx` | معدَّل | يستخدم `NotificationCenter` بدل Bell ثابت |
| `apps/web/app/(dashboard)/layout.tsx` | معدَّل | يمرر `userId` لـ Header |
| `supabase/functions/check-overdue-invoices/index.ts` | جديد | Edge Function: Cron يومي — فحص فواتير + إشعارات + email 7 أيام |
| `supabase/functions/send-booking-confirmation/index.ts` | جديد | Edge Function: تأكيد حجز بالبريد (Resend) |
| `supabase/functions/weekly-admin-report/index.ts` | جديد | Edge Function: تقرير أسبوعي للـ admin |
| `supabase/functions/send-whatsapp/index.ts` | جديد | Edge Function: إشعار WhatsApp عبر Twilio (اختياري) |
| `supabase/functions/.env` | جديد | متغيرات Edge Functions (Resend + Twilio) |

### جدول notifications

```sql
notifications(
  id          uuid PK,
  user_id     uuid FK → auth.users,
  type        text  -- 'overdue_invoice' | 'expiring_contract' | 'new_maintenance' | 'new_booking'
  title       text,
  body        text,
  read        boolean DEFAULT false,
  entity_id   uuid nullable,   -- مرجع الكيان (invoice_id / contract_id / ...)
  entity_type text nullable,   -- 'invoice' | 'contract' | 'maintenance' | 'booking'
  created_at  timestamptz
)
```

### دوال DB المُنشأة

| الدالة | الوظيفة |
|---|---|
| `create_notification(user_id, type, title, body, entity_id, entity_type)` | إنشاء إشعار واحد |
| `notify_admins_and_managers(type, title, body, entity_id, entity_type)` | إشعار جميع admin+manager |
| `check_and_notify_overdue_invoices()` | يومياً: تحديث overdue + إنشاء إشعارات |
| `check_and_notify_expiring_contracts()` | يومياً: إشعارات للعقود التي تنتهي خلال 30 يوم |
| `notify_new_maintenance()` | Trigger: إشعار تلقائي عند maintenance جديد |
| `notify_new_booking()` | Trigger: إشعار تلقائي عند booking جديد |

### Triggers التلقائية

| الـ Trigger | الجدول | الوظيفة |
|---|---|---|
| `trg_notify_new_maintenance` | `maintenance_requests` | إشعار admin+manager عند كل INSERT |
| `trg_notify_new_booking` | `bookings` | إشعار admin+manager عند كل INSERT |

### Cron Jobs — إعداد في Supabase Dashboard

انتقل إلى: **Supabase Dashboard > Edge Functions > Schedule (Cron)**

| الـ Function | الـ Schedule | التوقيت | الوظيفة |
|---|---|---|---|
| `check-overdue-invoices` | `0 4 * * *` | يومياً 08:00 دبي | فحص فواتير + إشعارات + email 7 أيام |
| `weekly-admin-report` | `0 4 * * 1` | الاثنين 08:00 دبي | تقرير أسبوعي بالإيميل لـ admin |

**HTTP Method:** POST  
**Authorization Header:** `Bearer <SUPABASE_SERVICE_ROLE_KEY>`

### إعداد Resend

1. إنشاء حساب على [resend.com](https://resend.com)
2. التحقق من الدومين أو استخدام `onboarding@resend.dev` للتطوير
3. إنشاء API Key وإضافته في Edge Functions Secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxx
   supabase secrets set FROM_EMAIL=noreply@yourdomain.com
   supabase secrets set APP_NAME="Real Estate Manager"
   ```

### إعداد Twilio WhatsApp (اختياري)

1. إنشاء حساب Twilio واختبار الـ Sandbox
2. إضافة الـ secrets:
   ```bash
   supabase secrets set TWILIO_ACCOUNT_SID=ACxxxx
   supabase secrets set TWILIO_AUTH_TOKEN=xxxx
   supabase secrets set TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   ```
3. استدعاء الـ function:
   ```ts
   // من Server Action عند الحاجة:
   await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-whatsapp`, {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({ invoice_id: '...' }),
   })
   ```

### استدعاء send-booking-confirmation من Server Action

في `apps/web/app/(dashboard)/dashboard/bookings/actions.ts` أضف بعد إنشاء الحجز:

```ts
// إرسال تأكيد بالبريد (fire-and-forget)
fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-booking-confirmation`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ booking_id: newBooking.id }),
}).catch(() => {}) // لا تعطّل العملية إذا فشل الإيميل
```

### 8.22 NotificationCenter — نمط آمن مع Realtime

- `NotificationCenter` هو Client Component يستخدم `createClient()` (browser client).
- يُمرَّر `userId` من Server Component (Dashboard Layout) — لا يُستدعى `supabase.auth.getUser()` داخله.
- Realtime channel يُنشأ مرة واحدة في `useEffect` ويُلغى عند unmount.
- Badge count يُحسب من `notifications.filter(n => !n.read).length` — يتحدث تلقائياً مع كل INSERT.
- قاعدة RLS تضمن أن الـ filter `user_id=eq.${userId}` في الـ channel يطابق ما تسمح به الـ policy.

---

## 11. نظام Auth (مكتمل — 2026-04-07)

### الملفات المُنشأة أو المُعدَّلة

| الملف | الحالة | الوصف |
|---|---|---|
| `packages/types/src/index.ts` | معدَّل | `UserRole` → `'admin' \| 'manager' \| 'accountant' \| 'maintenance'` |
| `apps/web/app/(auth)/login/actions.ts` | جديد | Server Action: `loginAction` محمي من CSRF |
| `apps/web/app/(auth)/login/page.tsx` | معدَّل | يستخدم `useActionState` |
| `apps/web/hooks/useAuth.ts` | جديد | Hook: `{ user, role, loading, signOut }` |
| `apps/web/middleware.ts` | معدَّل | Role-based protection |
| `apps/web/components/layout/Sidebar.tsx` | معدَّل | يقبل `role` prop |
| `apps/web/components/layout/Header.tsx` | معدَّل | ألقاب الأدوار بالعربية |
| `apps/web/app/(dashboard)/layout.tsx` | معدَّل | يمرر `role` للـ Sidebar |

### Middleware — حماية المسارات

| المسار | الأدوار المسموح لها |
|---|---|
| `/dashboard/properties` | admin, manager |
| `/dashboard/tenants` | admin, manager |
| `/dashboard/contracts` | admin, manager |
| `/dashboard/bookings` | admin, manager |
| `/dashboard/invoices` | admin, accountant |
| `/dashboard/maintenance` | admin, maintenance |
| `/dashboard/settings` | admin فقط |

### Sidebar حسب الدور

| الدور | العناصر الظاهرة |
|---|---|
| `admin` | كل شيء + الإعدادات |
| `manager` | التحكم، العقارات، المستأجرون، العقود، الحجوزات |
| `accountant` | التحكم، الفواتير |
| `maintenance` | التحكم، الصيانة |

---

## 12. وحدة إدارة العقارات (مكتملة — 2026-04-08)

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `apps/web/lib/utils.ts` | دالة `cn()` لدمج Tailwind classes |
| `apps/web/components/ui/button.tsx` | Button مع CVA variants |
| `apps/web/components/ui/dialog.tsx` | Dialog كامل (Radix) |
| `apps/web/components/ui/input.tsx` | Input |
| `apps/web/components/ui/label.tsx` | Label (Radix) |
| `apps/web/components/ui/select.tsx` | Select كامل (Radix) |
| `apps/web/components/ui/textarea.tsx` | Textarea |
| `apps/web/components/properties/PropertiesClient.tsx` | Client wrapper للعقارات |
| `apps/web/components/properties/PropertyFormDialog.tsx` | Dialog إضافة/تعديل |
| `apps/web/components/properties/PropertyDetailClient.tsx` | زر التعديل في صفحة التفاصيل |
| `apps/web/app/(dashboard)/dashboard/properties/page.tsx` | Server Component (محدَّث) |
| `apps/web/app/(dashboard)/dashboard/properties/actions.ts` | Server Actions للـ CRUD |
| `apps/web/app/(dashboard)/dashboard/properties/[id]/page.tsx` | صفحة تفاصيل العقار (معدَّل: أُضيف رابط "إدارة الوحدات") |

### ميزات وحدة العقارات

- **Grid Cards** مع صورة + اسم + نوع + حالة + عنوان + عدد الوحدات
- **فلترة** حسب النوع (سكني / تجاري / بيزنس سنتر / مختلط)
- **بحث** بالاسم أو العنوان أو المدينة (client-side فوري)
- **إضافة عقار** عبر Dialog مع Zod validation
- **تعديل عقار** — نفس الـ Dialog يُعبَّأ بالبيانات الحالية
- **حذف عقار** مع confirm dialog
- **رفع صورة** لـ Supabase Storage مع preview فوري
- **صفحة تفاصيل** `/dashboard/properties/[id]`:
  - بيانات العقار الكاملة
  - 4 إحصائيات: إجمالي الوحدات، مشغولة، متاحة، نسبة الإشغال
  - قائمة الوحدات مع النوع والمساحة والطابق والإيجار والحالة
  - زر "إدارة الوحدات" يقود لـ `/dashboard/properties/[id]/units`
- **Toast notifications** عند نجاح أو فشل أي عملية
- **Loading states** مع spinner أثناء الإرسال
- **revalidatePath** بعد كل عملية CRUD لتحديث البيانات

---

## 13. وحدة إدارة الوحدات (مكتملة — 2026-04-08)

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `apps/web/app/(dashboard)/dashboard/properties/[id]/units/page.tsx` | Server Component — يجلب وحدات + عقود + صيانة بـ Promise.all |
| `apps/web/app/(dashboard)/dashboard/properties/[id]/units/actions.ts` | Server Actions: `createUnit`, `updateUnit`, `updateUnitStatus` |
| `apps/web/components/units/UnitsClient.tsx` | TanStack Table + فلترة بالحالة + تغيير حالة inline |
| `apps/web/components/units/UnitFormDialog.tsx` | Dialog إضافة/تعديل + رفع صور متعددة |
| `apps/web/components/units/UnitDetailDialog.tsx` | بطاقة تفاصيل: مستأجر حالي + تاريخ عقود + طلبات صيانة |
| `apps/web/components/units/OccupancyWidget.tsx` | Recharts Donut chart + إيرادات هذا الشهر |

### ميزات وحدة الوحدات

- **TanStack Table** مع أعمدة: رقم الوحدة، الطابق، النوع، المساحة (م²)، الإيجار (د.إ)، الحالة
- **Color-coded status badges**: متاح (أخضر) / مؤجر (أحمر) / صيانة (برتقالي) / محجوز (أصفر)
- **فلترة** بـ Tab Bar يُظهر عدد كل حالة
- **Sort** قابل للنقر على أعمدة: رقم الوحدة، المساحة، الإيجار
- **تغيير الحالة inline** من داخل الجدول مباشرة
- **Dialog إضافة/تعديل** مع: رقم الوحدة، الطابق، النوع (شقة/مكتب/محل...)، المساحة، الإيجار، ملاحظات، صور متعددة
- **بطاقة التفاصيل**: معلومات أساسية + صور + مستأجر حالي (اسم، هاتف، بريد، بداية/نهاية العقد) + تاريخ عقود سابقة + طلبات الصيانة
- **OccupancyWidget**: Donut chart يوضح نسب الحالات الأربع + نسبة الإشغال % + إجمالي إيرادات الشهر (د.إ)
- **Breadcrumb**: العقارات ← اسم العقار ← الوحدات

### ملاحظات تقنية

- `as any` مُضاف على INSERT/UPDATE لـ Supabase — نفس المشكلة الموجودة في `properties/actions.ts` (pre-existing)
- الحزمة `@tanstack/react-table ^8.21.3` مُضافة في `apps/web/package.json`
- الصور ترفع في `property-images` bucket بمسار `units/{timestamp}-{random}.{ext}`
- `<SelectItem value="none">` بدلاً من `value=""` — Radix يرفض القيمة الفارغة
- تنسيق الأرقام والعملة: `ar-AE` / `د.إ`

---

## 14. ملاحظات TypeScript (pre-existing)

المشروع يحتوي على أخطاء TS موجودة قبل أي تعديل:

| الخطأ | السبب | التأثير |
|---|---|---|
| `TS2786: 'Button/Dialog/Select' cannot be used as JSX` | React 19 + @types/react incompatibility | لا يمنع `next dev` |
| `TS2345/TS2769` في Supabase queries | Supabase untyped responses in some files | لا يمنع `next dev` |

الحل المؤقت: إضافة `as any` على INSERT/UPDATE عند الحاجة.

---

## 15. وحدة المستأجرين (مكتملة — 2026-04-08)

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `supabase/migrations/003_add_payment_cycle_and_tenant_documents.sql` | إضافة `payment_cycle` للعقود + `documents[]` للمستأجرين |
| `packages/types/src/index.ts` | إضافة `PaymentCycle` type + تحديث `Tenant` و`Contract` |
| `apps/web/app/(dashboard)/dashboard/tenants/actions.ts` | Server Actions: `createTenant`, `updateTenant`, `deleteTenant` |
| `apps/web/app/(dashboard)/dashboard/tenants/page.tsx` | Server Component — يجلب المستأجرين + عدد العقود الفعّالة |
| `apps/web/components/tenants/TenantsClient.tsx` | TanStack Table + بحث + فلترة بالحالة |
| `apps/web/components/tenants/TenantFormDialog.tsx` | Dialog إضافة/تعديل + رفع مستندات |
| `apps/web/components/ui/combobox.tsx` | Combobox قابل للبحث (مُستخدم في نموذج العقود) |

### ميزات وحدة المستأجرين

- **TanStack Table** مع أعمدة: المستأجر+الشركة، الهاتف، الإيميل، رقم الهوية، العقود الفعّالة، الحالة
- **بحث** بالاسم / الهاتف / الإيميل / رقم الهوية (client-side فوري)
- **فلترة** بـ Tab Bar: الكل، نشط، غير نشط، محظور
- **Dialog إضافة/تعديل** مع: الاسم، الهاتف، رقم الهوية، البريد، الشركة، العنوان، الحالة، الملاحظات
- **رفع المستندات** (هوية / جواز سفر) لـ Supabase Storage بمسار `tenants/documents/`
- **حذف مستأجر** مع confirm
- **Toast notifications** عند نجاح/فشل كل عملية

---

## 16. وحدة العقود (مكتملة — 2026-04-08)

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `apps/web/app/(dashboard)/dashboard/contracts/actions.ts` | Server Actions: `createContract`, `terminateContract` |
| `apps/web/app/(dashboard)/dashboard/contracts/page.tsx` | Server Component — 4 استعلامات متوازية |
| `apps/web/app/(dashboard)/dashboard/contracts/[id]/page.tsx` | صفحة تفاصيل العقد + سجل الفواتير |
| `apps/web/components/contracts/ContractsClient.tsx` | قائمة العقود + فلاتر متعددة |
| `apps/web/components/contracts/ContractFormDialog.tsx` | Dialog إنشاء عقد مع Combobox |
| `apps/web/components/contracts/ContractDetailClient.tsx` | زر "إنهاء العقد" مع Dialog تأكيد |

### ميزات وحدة العقود

- **قائمة العقود** مع أعمدة: المستأجر، الوحدة، قيمة الإيجار، دورية الدفع، البداية، النهاية، الحالة
- **فلترة** حسب: الحالة (Tabs) + العقار (Select) + المستأجر (Select)
- **تحذير "تنتهي قريباً"** للعقود التي تنتهي خلال ≤30 يوم (أيقونة + عدد الأيام في الجدول)
- **Dialog إنشاء عقد** مع Combobox للوحدات المتاحة فقط + Combobox للمستأجرين
- **auto-fill** قيمة الإيجار عند اختيار الوحدة
- **دورية الدفع**: شهري / ربعي / سنوي
- **DB Trigger** يحدّث `units.status` إلى `occupied` عند إنشاء عقد فعّال تلقائياً
- **صفحة تفاصيل العقد** `/dashboard/contracts/[id]`:
  - بيانات العقد الكاملة (تواريخ، إيجار، دورية، تأمين)
  - بيانات المستأجر والوحدة
  - سجل الفواتير المرتبطة
  - زر "إنهاء العقد" مع Dialog تأكيد → يحدّث الوحدة تلقائياً عبر DB Trigger
- **تنبيه "ينتهي قريباً"** Banner أصفر في صفحة التفاصيل

### Sidebar Badge

- **Badge أصفر** على عنصر "العقود" في الـ Sidebar يُظهر عدد العقود التي تنتهي خلال 30 يوم
- يُحسب في `(dashboard)/layout.tsx` بـ Supabase query مع `lte('end_date', threshold)`

---

## 17. وحدة الفواتير والمدفوعات (مكتملة — 2026-04-10)

### Migrations المطبَّقة

| الملف | الحالة | المحتوى |
|---|---|---|
| `005_invoices_enhancements.sql` | ✅ مطبَّق | إضافة `reference_number TEXT` لجدول `invoices` + دالة `generate_monthly_invoices(p_year, p_month)` SECURITY DEFINER |
| `006_fix_invoices_select_policy.sql` | ✅ مطبَّق | دالة `can_access_invoices()` + إعادة كتابة policies الفواتير الأربعة + توسيع profiles_role_check ليشمل `accountant` و`maintenance` |

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `apps/web/app/(dashboard)/dashboard/invoices/actions.ts` | Server Actions: `createInvoice`, `recordPayment`, `generateMonthlyInvoices`, `cancelInvoice` |
| `apps/web/components/invoices/InvoicesClient.tsx` | جدول مع بحث + فلتر الحالة (Tabs) + فلتر العقار + زر "توليد فواتير الشهر" + زر دفع + إلغاء |
| `apps/web/components/invoices/InvoiceFormDialog.tsx` | Dialog إنشاء فاتورة يدوية: المستأجر، العقد، النوع، المبلغ، الضريبة، تاريخ الاستحقاق |
| `apps/web/components/invoices/PaymentDialog.tsx` | Dialog تسجيل دفعة: المبلغ، طريقة الدفع، رقم مرجعي (للتحويل/الشيك)، التاريخ |
| `apps/web/components/invoices/FinancialOverview.tsx` | 4 KPI cards + Recharts BarChart (آخر 6 أشهر) + قائمة أكثر المتأخرين |

### الملفات المُعدَّلة

| الملف | التغيير |
|---|---|
| `apps/web/app/(dashboard)/dashboard/invoices/page.tsx` | إعادة كتابة كاملة — 7 استعلامات متوازية + `FinancialOverview` + `InvoicesClient` |
| `apps/web/app/(dashboard)/layout.tsx` | إضافة `overdueInvoicesCount` من Supabase |
| `apps/web/components/layout/Sidebar.tsx` | Badge أحمر على "الفواتير" بعدد المتأخرات |
| `packages/types/src/index.ts` | إضافة `reference_number: string \| null` للـ `Invoice` interface |

### ميزات الصفحة `/dashboard/invoices`

**Financial Overview (أعلى الصفحة):**
- **4 KPI cards**: المحصّل هذا الشهر، إجمالي المتأخرات + عددها، نسبة التحصيل، عدد المتأخرين
- **Bar Chart** (Recharts): تحصيل آخر 6 أشهر — يُعبَّأ تلقائياً حتى لو الأشهر فارغة
- **قائمة أكثر المتأخرين**: مرتبة تنازلياً بالمبلغ مع عدد الفواتير

**جدول الفواتير:**
- أعمدة: رقم الفاتورة، المستأجر، العقار/الوحدة، النوع، المبلغ، الاستحقاق، الحالة
- **تلوين الحالة**: مدفوعة (أخضر) / معلقة (أصفر) / متأخرة (أحمر) / جزئية (برتقالي) / ملغاة (رمادي)
- **بحث** برقم الفاتورة أو اسم المستأجر أو رقم الوحدة
- **فلتر الحالة** بـ Tab Bar مع العدد
- **فلتر العقار** بـ Select
- **زر "توليد فواتير الشهر"** — يستدعي `generate_monthly_invoices()` ويتخطى الفواتير الموجودة
- **زر دفع** (hover): يفتح `PaymentDialog`
- **زر إلغاء** (hover): يُلغي الفاتورة مع confirm

**PaymentDialog:**
- يُظهر ملخص الفاتورة (رقم + مستأجر + مبلغ) في الأعلى
- طرق الدفع: نقد / تحويل بنكي / شيك / بطاقة / دفع إلكتروني
- حقل "رقم مرجعي" يظهر فقط عند اختيار تحويل بنكي أو شيك
- يُحدّد الحالة تلقائياً: `paid` إذا المبلغ ≥ الإجمالي، `partial` إذا أقل

**Sidebar Badge:**
- Badge **أحمر** على "الفواتير" يُظهر عدد الفواتير بحالة `overdue`
- Badge **أصفر** على "العقود" يُظهر عدد العقود المنتهية خلال 30 يوم (سابق)
- Badge **برتقالي** على "الصيانة" يُظهر عدد الطلبات بحالة `open`
- تُجلب الثلاثة معاً في `(dashboard)/layout.tsx` بـ `Promise.all`

---

## 18. وحدة إدارة الصيانة (مكتملة — 2026-04-10)

### Migration المطبَّق

| الملف | الحالة | المحتوى |
|---|---|---|
| `007_maintenance_realtime.sql` | ✅ مطبَّق | دالة `can_access_maintenance()` SECURITY DEFINER + إعادة كتابة policies الصيانة (حذف `JOIN auth.users`) + إضافة دور `maintenance` للـ SELECT policy + `ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_requests` |

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `apps/web/app/(dashboard)/dashboard/maintenance/page.tsx` | Server Component — 5 استعلامات متوازية + حساب إحصائيات (open/inProgress/completedThisMonth/avgResolutionDays/categoryStats) |
| `apps/web/app/(dashboard)/dashboard/maintenance/actions.ts` | Server Actions: `createMaintenanceRequest`, `updateMaintenanceRequest` |
| `apps/web/components/maintenance/MaintenanceClient.tsx` | جدول + Kanban Board (toggle) + فلاتر (عقار/أولوية/حالة) + Supabase Realtime بـ dialogOpenRef |
| `apps/web/components/maintenance/MaintenanceRequestDialog.tsx` | Dialog رفع طلب: الوحدة (Combobox)، نوع المشكلة، الوصف، الأولوية، رفع صور متعددة |
| `apps/web/components/maintenance/UpdateStatusDialog.tsx` | Dialog تحديث: الحالة، تعيين فني، تكلفة الإصلاح، ملاحظات الإغلاق |
| `apps/web/components/maintenance/MaintenanceStats.tsx` | 4 KPI cards (مفتوح/جارٍ/مكتمل/متوسط الحل) + Recharts PieChart لتوزيع الأنواع |

### الملفات المُعدَّلة

| الملف | التغيير |
|---|---|
| `apps/web/app/(dashboard)/layout.tsx` | إضافة `openMaintenanceCount` (maintenance_requests WHERE status='open') إلى Promise.all |
| `apps/web/components/layout/Sidebar.tsx` | إضافة `openMaintenanceCount` prop + Badge برتقالي على "الصيانة" |

### ميزات الصفحة `/dashboard/maintenance`

**MaintenanceStats (أعلى الصفحة):**
- **4 KPI cards**: طلبات مفتوحة (أزرق) / قيد التنفيذ (أصفر) / مكتملة هذا الشهر (أخضر) / متوسط أيام الحل (بنفسجي)
- **Pie Chart** (Recharts): توزيع أنواع المشاكل — سباكة / كهرباء / مكيف / هيكلي / نظافة / أخرى
- ألوان ثابتة لكل نوع: `#3B82F6 / #F59E0B / #10B981 / #EF4444 / #8B5CF6 / #6B7280`
- يستثني الطلبات الملغاة من الـ Pie Chart

**MaintenanceClient — جدول:**
- أعمدة: الوحدة+العقار، النوع، العنوان+الوصف، الأولوية (مع نقطة ملونة)، الحالة، التاريخ
- النقر على أي صف يفتح `UpdateStatusDialog`

**MaintenanceClient — Kanban:**
- 3 أعمدة: مفتوح (أزرق) / قيد التنفيذ (أصفر) / مكتمل (أخضر)
- كل بطاقة: العنوان + أولوية + العقار/الوحدة + النوع + تاريخ + اسم الفني (إن وُجد)

**فلاتر:**
- فلتر العقار (Select)
- فلتر الأولوية: عاجلة / عالية / متوسطة / منخفضة
- فلتر الحالة: مفتوح / قيد التنفيذ / مكتمل / ملغي
- مؤشر "يعرض X من Y طلب" عند تطبيق فلتر

**MaintenanceRequestDialog:**
- Combobox للوحدة مع بحث (يعرض رقم الوحدة + اسم العقار كـ `sub`)
- Select للنوع: كهرباء / سباكة / مكيف / هيكلي / نظافة / أخرى
- Select للأولوية: منخفضة / متوسطة / عالية / عاجلة
- رفع صور متعددة مع preview + حذف فردي
- Zod validation server-side
- لا `useFormState` — يستخدم `useTransition` + `useState` للأخطاء (نمط المشروع)

**UpdateStatusDialog:**
- ملخص الطلب (العنوان، الوحدة، النوع، الأولوية) في الأعلى
- Select للحالة: مفتوح ← قيد التنفيذ ← مكتمل ← ملغي
- Select لتعيين فني (يُظهر فقط من لديه `full_name` — يتجنب عرض UUID)
- حقل التكلفة الفعلية (د.إ)
- حقل ملاحظات الإغلاق
- `key={selectedRequest.id}` على الـ Dialog لإعادة تهيئة الـ state عند تغيير الطلب

**Supabase Realtime:**
- يُستمع لأحداث `INSERT` على `maintenance_requests`
- عند وصول طلب جديد: `toast.info('طلب صيانة جديد وصل!')` يظهر دائماً
- `router.refresh()` يُستدعى فقط إذا `dialogOpenRef.current === false`
- يمنع بق Radix `pointer-events: none` الناتج عن `router.refresh()` أثناء فتح Dialog

---

## 19. وحدة قاعات الاجتماعات والحجوزات (مكتملة — 2026-04-13)

### Migrations المطبَّقة

| الملف | الحالة | المحتوى |
|---|---|---|
| `008_fix_bookings_rls.sql` | ✅ مطبَّق | إصلاح `JOIN auth.users` bug في: `bookings_select` + `tenants_select` + `contracts_select` — إعادة كتابتها بدون أي JOIN |

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `apps/web/app/(dashboard)/dashboard/bookings/page.tsx` | Server Component — 6 استعلامات متوازية + حساب todayCount + upcomingCount + monthRevenue |
| `apps/web/app/(dashboard)/dashboard/bookings/actions.ts` | Server Actions: `createBooking`, `updateBookingStatus`, `createMeetingRoom`, `updateMeetingRoom`, `deleteMeetingRoom` |
| `apps/web/components/bookings/BookingsPageClient.tsx` | واجهة التبويبات: الحجوزات / القاعات — كل JSX inline بدون inner components |
| `apps/web/components/bookings/BookingFormDialog.tsx` | Dialog حجز جديد: اختيار القاعة، المستأجر، النوع، التواريخ، الحساب التلقائي للمبلغ |
| `apps/web/components/bookings/UpdateBookingDialog.tsx` | Dialog تحديث الحجز: عرض ملخص + تغيير الحالة |
| `apps/web/components/bookings/MeetingRoomFormDialog.tsx` | Dialog إضافة/تعديل قاعة: الاسم، السعة، 3 أسعار، الحالة، الوصف |

### ميزات الصفحة `/dashboard/bookings`

**Stats Bar (أعلى الصفحة):**
- **4 KPI cards**: حجوزات اليوم / قادمة / عدد القاعات / إيرادات الشهر (د.إ)
- الإيرادات تشمل فقط الحجوزات بحالة `confirmed` أو `completed`

**تبويب الحجوزات:**
- جدول الحجوزات: القاعة+العقار، المستأجر، النوع، وقت البدء، المدة، المبلغ، الحالة، زر تعديل
- **فلتر العقار** بـ Select
- **فلتر الحالة**: الكل / معلق / مؤكد / منتهٍ / ملغي
- **حالات مرمّزة بالألوان**: معلق (أصفر) / مؤكد (أخضر) / منتهٍ (رمادي) / ملغي (أحمر)
- **Empty state** يقترح الانتقال لتبويب القاعات إذا لم توجد قاعات بعد

**تبويب القاعات:**
- بطاقات Grid للقاعات: اسم القاعة، العقار، السعة، الأسعار الثلاثة، الحالة، أزرار تعديل/حذف
- **حالات القاعة**: متاحة (أخضر) / غير متاحة (رمادي) / صيانة (برتقالي)
- **Empty state** بارز مع زر "إضافة أول قاعة" مباشرةً

**BookingFormDialog:**
- Combobox للقاعات (يعرض فقط الـ `available`) مع اسم العقار كـ `sub`
- لوحة معلومات الأسعار تظهر عند اختيار القاعة (ساعي / نصف يوم / يوم كامل)
- Combobox للمستأجر (اختياري)
- Select لنوع الحجز: بالساعة / نصف يوم (4 ساعات) / يوم كامل (8 ساعات)
- `useEffect` يضبط `end_time` تلقائياً عند تغيير النوع أو `start_time`
- مربع "إجمالي الحجز" يُحدَّث لحظياً بناءً على الاختيارات
- كشف خطأ تداخل الحجوزات (`overlap`) وعرضه للمستخدم

**UpdateBookingDialog:**
- ملخص الحجز: القاعة، العقار، الوقت، المستأجر، النوع، المبلغ
- Select للحالة الجديدة مع تعطيل زر "حفظ" إذا لم تتغير الحالة
- `variant="destructive"` تلقائياً عند اختيار "ملغي"

**MeetingRoomFormDialog:**
- `isEdit = !!room` — نفس الـ Dialog للإضافة والتعديل
- Combobox للعقار
- شبكة أسعار 3 أعمدة: ساعي / نصف يوم / يوم كامل
- Select للحالة: متاحة / غير متاحة / صيانة

### البنية التقنية

- **Server Actions**: كل CRUD عبر `useTransition` + `startTransition` + `useState` للأخطاء
- **لا inner function components**: `BookingsPageClient.tsx` يُدمج كل JSX مباشرةً لمنع React remount bug
- **Action button ديناميكي**: يتبدّل بين "حجز جديد" و"إضافة قاعة" حسب التبويب النشط
- **حذف القاعة**: `confirm()` client-side + `deleteMeetingRoom` Server Action + revalidatePath

---

## 21. SaaS Multi-tenant (مكتمل — 2026-04-18)

### Migration المطبَّق

| الملف | المحتوى |
|---|---|
| `011_saas_multitenancy.sql` | جدول `companies` + `company_id` لجميع الجداول + `get_user_company_id()` + إعادة كتابة كاملة لـ RLS + تحديث `generate_monthly_invoices` |

### جدول companies

```sql
companies(
  id                  uuid PK,
  name                text,
  slug                text UNIQUE,
  logo_url            text nullable,
  owner_id            uuid FK → auth.users,
  subscription_plan   text  -- 'free' | 'pro' | 'enterprise'
  subscription_status text  -- 'active' | 'trialing' | 'past_due' | 'canceled'
  trial_ends_at       timestamptz nullable,
  max_properties      int nullable,  -- NULL = unlimited
  max_units           int nullable,
  max_users           int nullable,
  created_at          timestamptz,
  updated_at          timestamptz
)
```

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `supabase/migrations/011_saas_multitenancy.sql` | Migration كامل |
| `apps/web/lib/supabase/company.ts` | `getUserCompanyId()` helper للـ Server Actions |
| `apps/web/app/(onboarding)/layout.tsx` | Layout بسيط لصفحة الـ Onboarding |
| `apps/web/app/(onboarding)/onboarding/page.tsx` | يقرأ `?plan` من searchParams ويمرره للـ Form |
| `apps/web/app/(onboarding)/onboarding/actions.ts` | `createCompany`: adminClient + upsert + verify قبل redirect |
| `apps/web/components/onboarding/CompanySetupForm.tsx` | يقبل `initialPlan` prop — يستخدم `useActionState` مباشرة (بدون startTransition) |
| `apps/web/app/(dashboard)/dashboard/settings/subscription/page.tsx` | صفحة الاشتراكات: plan + usage bars + مقارنة الباقات |
| `apps/web/app/page.tsx` | Landing Page: Navbar + Hero + Features (6) + Pricing (free/pro) + Footer |
| `apps/web/app/(auth)/register/page.tsx` | صفحة التسجيل — تقرأ `?plan` وتعرضه + شاشة "تحقق من بريدك" |
| `apps/web/app/(auth)/register/actions.ts` | `registerAction`: signUp → يفحص `data.session` → redirect أو emailConfirmationRequired |

### الملفات المُعدَّلة

| الملف | التغيير |
|---|---|
| `packages/types/src/index.ts` | إضافة `Company`, `SubscriptionPlan`, `SubscriptionStatus` + `company_id` في `Profile` |
| `apps/web/middleware.ts` | أضاف `/` لـ PUBLIC_ROUTES (exact match) + `/register` + يوجّه لـ `/onboarding` إذا لا يوجد `company_id` |
| `apps/web/app/(auth)/login/page.tsx` | أضاف رابط "إنشاء حساب جديد" → `/register` |
| `apps/web/app/(dashboard)/layout.tsx` | يجلب `companyName` و`subscriptionPlan` ويمررهما للـ Sidebar |
| `apps/web/components/layout/Sidebar.tsx` | يعرض اسم الشركة + badge الباقة + رابط "الاشتراك" |
| `apps/web/app/(dashboard)/dashboard/properties/actions.ts` | `createProperty` يضيف `company_id` |
| `apps/web/app/(dashboard)/dashboard/properties/[id]/units/actions.ts` | `createUnit` يضيف `company_id` |
| `apps/web/app/(dashboard)/dashboard/tenants/actions.ts` | `createTenant` يضيف `company_id` |
| `apps/web/app/(dashboard)/dashboard/contracts/actions.ts` | `createContract` + invoices يضيفان `company_id` |
| `apps/web/app/(dashboard)/dashboard/maintenance/actions.ts` | `createMaintenanceRequest` يضيف `company_id` |
| `apps/web/app/(dashboard)/dashboard/bookings/actions.ts` | `createBooking` + `createMeetingRoom` يضيفان `company_id` |

### نظام الباقات

| الباقة | العقارات | الوحدات | المستخدمون | السعر |
|---|---|---|---|---|
| `free` | 3 | 20 | 2 | مجاناً |
| `pro` | غير محدود | غير محدود | غير محدود | 99 د.إ/شهر |
| `enterprise` | غير محدود | غير محدود | غير محدود | تفاوض |

### نمط RLS الجديد

كل policy على كل جدول تشترط:
1. `company_id = get_user_company_id()` — عزل الشركة
2. `is_admin_or_manager()` أو الدالة الخاصة بالجدول (can_access_invoices, can_access_maintenance)

### تدفق التسجيل الكامل (مُحدَّث)

```
/ (Landing Page) → /register?plan=pro → (signup) → /onboarding?plan=pro → /dashboard
```

1. الزائر يختار باقة من Landing Page → `/register?plan=pro`
2. يُدخل الاسم + الإيميل + كلمة المرور → `registerAction` يستدعي `supabase.auth.signUp()`
3. إذا لم تكن هناك session (email confirmation مُفعَّل) → تُعرض شاشة "تحقق من بريدك"
4. إذا كانت هناك session → `redirect('/onboarding?plan=pro')`
5. صفحة `/onboarding` تقرأ `plan` من searchParams وتُحدد الباقة مسبقاً
6. `createCompany` يستخدم `adminClient` (service role) لـ:
   - فحص تفرّد الـ slug (يقرأ كل الشركات)
   - إنشاء الشركة بـ UUID مُولَّد مسبقاً (تجنب SELECT-after-INSERT RLS issue)
   - upsert الـ profile (يضمن وجود الـ row حتى لو trigger لم يُنشئه)
   - التحقق من نجاح الربط قبل الـ redirect
7. `redirect('/dashboard')`

### البيانات الموجودة

البيانات الموجودة تم نقلها إلى شركة افتراضية:
- `id = '00000000-0000-0000-0000-000000000001'`
- `name = 'الشركة الافتراضية'`
- `subscription_plan = 'pro'` (مع `max_properties = NULL`)

---

## 22. القرارات التقنية — Landing Page & Registration (2026-04-19)

### 8.23 isPublicRoute — exact match لـ `/`
- `PUBLIC_ROUTES.some(route => pathname.startsWith(route))` يُطابق كل المسارات إذا كان `/` في القائمة.
- الحل: `route === '/' ? pathname === '/' : pathname.startsWith(route)`.

### 8.24 redirect() + useActionState — لا تستخدم startTransition
- `startTransition(() => formAction(formData))` يمنع `redirect()` من العمل داخل Server Actions.
- الحل: استخدام `const [state, formAction, isPending] = useActionState(...)` مباشرةً + `<form action={formAction}>`.
- النمط الصحيح: نفس ما يستخدمه login page.

### 8.25 createCompany — SELECT-after-INSERT RLS issue
- بعد INSERT في `companies`، الكود كان يعمل `.select('id')` لكن policy تقول `id = get_user_company_id()` وهي NULL للمستخدم الجديد → data = null رغم نجاح الـ INSERT.
- الحل: توليد UUID مسبقاً بـ `crypto.randomUUID()` وعدم الاعتماد على SELECT.

### 8.26 createCompany — استخدام adminClient (service role)
- جميع عمليات `createCompany` (slug check, company insert, profile upsert, verify) تعمل عبر `adminClient` من `@supabase/supabase-js` مع `SUPABASE_SERVICE_ROLE_KEY`.
- السبب: تجاوز RLS بأمان داخل Server Action موثوق.

### 8.27 profile upsert بدل update في Onboarding
- إذا لم يُنشئ trigger `on_auth_user_created` الـ profile (فشل صامت أو تأخر)، فإن `update` يُكمل بدون خطأ لكن بدون تأثير (0 rows).
- الحل: `upsert` مع `onConflict: 'id'` + SELECT للتحقق بعد الـ upsert قبل الـ redirect.

### 8.28 Email Confirmation في Supabase
- `signUp()` قد لا يُنشئ session فورية إذا كان "Confirm email" مُفعَّلاً.
- الكشف: فحص `data.session` بعد `signUp()` — إذا null → `emailConfirmationRequired: true`.
- للـ development: تعطيل من Supabase Dashboard → Authentication → Providers → Email → Confirm email: OFF.

---

## 20. ما لم يُنجز بعد

- [ ] صفحة `access_denied` مخصصة بدلاً من redirect صامت
- [ ] تخزين `company_id` و`role` في JWT custom claims لتفادي query إضافية في الـ middleware
- [ ] تفعيل Stripe أو نظام دفع لترقية الباقات
- [ ] تطبيق الجوال (هيكل فارغ حتى الآن)
- [ ] إعداد Supabase Edge Functions أو pg_cron لـ `mark_overdue_invoices()` تلقائياً كل يوم
- [ ] إعداد Supabase Edge Functions أو pg_cron لـ `generate_monthly_invoices()` تلقائياً أول كل شهر
- [ ] تطبيق Migration 012 في Supabase Dashboard (employees + receptionist role)
- [ ] تكامل usePermissions() مع باقي مكونات الـ dashboard لإخفاء الأزرار
- [ ] اختبارات (لا توجد بعد)

---

## 23. إدارة الموظفين + دور receptionist (مكتمل — 2026-04-19)

### Migration المطبَّق

| الملف | المحتوى |
|---|---|
| `012_employees_and_receptionist.sql` | إضافة `receptionist` للـ constraint + `can_access_bookings()` + جدول `employees` + جدول `employee_invitations` + تحديث `tenants_select` + تحديث `bookings_update` |

### الملفات المُنشأة

| الملف | الوصف |
|---|---|
| `supabase/migrations/012_employees_and_receptionist.sql` | Migration كامل |
| `apps/web/hooks/usePermissions.ts` | Hook: `canView()`, `canEdit()`, `canDelete()` بناءً على الدور |
| `apps/web/app/(dashboard)/dashboard/employees/page.tsx` | Server Component — يجلب الموظفين للشركة |
| `apps/web/app/(dashboard)/dashboard/employees/actions.ts` | `inviteEmployee`, `updateEmployeeRole`, `toggleEmployeeStatus` |
| `apps/web/components/employees/EmployeesClient.tsx` | جدول الموظفين + تعديل الدور inline + toggle الحالة |
| `apps/web/components/employees/InviteEmployeeDialog.tsx` | Dialog دعوة موظف: اسم + إيميل + هاتف + دور |
| `apps/web/app/(auth)/accept-invite/page.tsx` | Server Component: يتحقق من token + يعرض النموذج |
| `apps/web/app/(auth)/accept-invite/AcceptInviteForm.tsx` | Client Component: نموذج إنشاء الحساب |
| `apps/web/app/(auth)/accept-invite/actions.ts` | `getInvitationByToken`, `acceptInviteAction` |

### الملفات المُعدَّلة

| الملف | التغيير |
|---|---|
| `packages/types/src/index.ts` | إضافة `receptionist` لـ UserRole + `Employee` + `EmployeeInvitation` interfaces |
| `apps/web/hooks/useAuth.ts` | إضافة `companyId` للـ state المُرجَع |
| `apps/web/components/layout/Sidebar.tsx` | إضافة receptionist لـ business-center + إضافة "الموظفون" (admin فقط) |
| `apps/web/middleware.ts` | إضافة `/accept-invite` لـ PUBLIC_ROUTES + `/dashboard/employees` + receptionist للـ business-center/bookings |
| `apps/web/app/(auth)/login/page.tsx` | رسالة نجاح عند القدوم من accept-invite |

### جداول قاعدة البيانات الجديدة

```sql
employees(
  id uuid PK, company_id uuid FK, user_id uuid nullable FK → auth.users,
  name text, email text, phone text nullable, role text, status text,
  invited_by uuid nullable, joined_at timestamptz nullable,
  created_at timestamptz, updated_at timestamptz
)

employee_invitations(
  id uuid PK, company_id uuid FK, employee_id uuid FK,
  email text, role text, token text UNIQUE,
  invited_by uuid nullable, expires_at timestamptz,
  accepted_at timestamptz nullable, created_at timestamptz
)
```

### دوال DB المُنشأة

| الدالة | الوظيفة |
|---|---|
| `can_access_bookings()` | Boolean: admin أو manager أو receptionist |

### تدفق الدعوة

```
admin → /dashboard/employees → "دعوة موظف" → inviteEmployee()
→ employee_invitations record + employees record (user_id=null)
→ email عبر Resend إلى المدعو (رابط /accept-invite?token=...)
→ المدعو يملأ: اسم + كلمة مرور → acceptInviteAction()
→ createUser (Supabase Auth) + upsert profile (company_id + role)
→ employee.user_id يُحدَّث + invitation.accepted_at
→ redirect /login?message=account_created
```

### دور receptionist

| المورد | يرى | يعدّل | يحذف |
|---|---|---|---|
| الحجوزات (business-center) | ✓ | ✓ | ✗ |
| بيانات المستأجرين (للحجز) | ✓ | ✗ | ✗ |
| البيانات المالية | ✗ | ✗ | ✗ |
| الصيانة / العقارات / العقود | ✗ | ✗ | ✗ |

### usePermissions() hook

```ts
const { canView, canEdit, canDelete } = usePermissions()

// مثال:
if (canDelete('properties')) { /* عرض زر الحذف */ }
```

Resources: `'properties' | 'tenants' | 'contracts' | 'invoices' | 'maintenance' | 'bookings' | 'employees' | 'reports'`

### 8.29 employees + invitations — استخدام adminClient

- `inviteEmployee` يستخدم `adminClient` (service role) لـ: فحص البريد المكرر، إنشاء employee record، إنشاء invitation record.
- `acceptInviteAction` يستخدم `adminClient` لـ: إنشاء Supabase user (`auth.admin.createUser`)، upsert profile، ربط employee بالـ user_id.
- باقي operations (updateEmployeeRole, toggleEmployeeStatus) تستخدم SSR client العادي لأن RLS يسمح للـ admin.

### 8.30 RESEND_API_KEY — استخدام مباشر في Server Action

- إيميل الدعوة يُرسَل عبر `fetch('https://api.resend.com/emails', ...)` مباشرةً دون مكتبة.
- `NEXT_PUBLIC_APP_URL` مُستخدم لبناء رابط الدعوة.
- فشل الإيميل لا يوقف العملية — الـ employee record والـ invitation ينشآن بغض النظر.

---

## 24. نظام الدفع المرن للعقود (مكتمل — 2026-04-22)

### Migrations

| الملف | المحتوى |
|---|---|
| `010_fix_generate_monthly_invoices.sql` | إضافة `total_amount`, `payment_count`, `payment_amount` لجدول `contracts` + backfill للعقود القديمة + إعادة كتابة `generate_monthly_invoices()` |

### الأعمدة الجديدة في جدول contracts

| العمود | النوع | الوصف |
|---|---|---|
| `total_amount` | numeric(12,2) | إجمالي الإيجار السنوي |
| `payment_count` | int | عدد الدفعات (1/2/3/4/12 أو مخصص) |
| `payment_amount` | numeric(12,2) | قيمة كل دفعة = total_amount / payment_count |

الـ backfill للعقود القديمة: `total_amount = monthly_rent * 12`, `payment_count = 12`, `payment_amount = monthly_rent`

### الملفات المُعدَّلة

| الملف | التغيير |
|---|---|
| `apps/web/components/contracts/ContractFormDialog.tsx` | إعادة كتابة كاملة بنظام الدفع المرن |
| `apps/web/app/(dashboard)/dashboard/contracts/actions.ts` | `createContract` ينشئ الفواتير تلقائياً + `terminateContract` يُعيد الوحدة لـ available |
| `apps/web/components/contracts/ContractsClient.tsx` | يعرض `total_amount` و`payment_amount` وطريقة الدفع بدلاً من `monthly_rent` |
| `apps/web/app/(dashboard)/dashboard/contracts/[id]/page.tsx` | يعرض الأعمدة الجديدة في بطاقة التفاصيل المالية |

### ContractFormDialog — نظام الدفع المرن

- حقل `total_amount` = إجمالي الإيجار السنوي
- خيارات الدفع: 1 دفعة / 2 (كل 6 أشهر) / 3 (كل 4 أشهر) / 4 (كل 3 أشهر) / 12 (شهري) / مخصص
- `payment_amount` = total / count يُحسب تلقائياً
- جدول دفعات قابل للتعديل: كل صف يحتوي `input[date]` + `input[number]` للتاريخ والمبلغ
- زر "إعادة ضبط" يُعيد الجدول للتواريخ المحسوبة تلقائياً
- تحذير إذا مجموع المبالغ المعدّلة ≠ إجمالي العقد
- عند الحفظ: تُنشأ فاتورة منفصلة لكل دفعة تلقائياً في جدول `invoices`

### اختيار المستأجر باسم الشركة

```tsx
// ContractFormDialog — يعرض اسم الشركة كعنوان رئيسي إذا توفّر
const tenantOptions = tenants.map((t) => ({
  value: t.id,
  label: t.company_name?.trim() ? t.company_name : t.full_name,
  sub:   t.company_name?.trim() ? t.full_name : (t.phone ?? t.email ?? ''),
}))
```

### generate_monthly_invoices — التحديثات

- يتخطى العقود بـ `payment_count ≠ 12` (لها فواتير مُنشأة مسبقاً عند حفظ العقد)
- يستخدم `PERFORM ... ; IF FOUND THEN` بدلاً من `SELECT EXISTS INTO v_exists` (كان يُسبب خطأ 42P01)
- يستخدم `COALESCE(payment_amount, monthly_rent)` للمبلغ عند توليد الفاتورة

---

## 25. إصلاحات UI (2026-04-22)

### 8.31 Combobox — عرض النص كاملاً

- استبدال `truncate` بـ `break-words` في خيارات الـ dropdown
- الملف: `apps/web/components/ui/combobox.tsx`
- الزر الرئيسي يحتفظ بـ `truncate` (عرض محدود)، لكن القائمة المنسدلة تعرض النص كاملاً

### 8.32 Dialog — منع الإغلاق بالضغط خارجها

- إضافة `onInteractOutside={(e) => e.preventDefault()}` في `DialogContent` الأساسي
- الملف: `apps/web/components/ui/dialog.tsx`
- يشمل جميع dialogs التطبيق — لا تُغلق إلا بزر **X** أو **إلغاء**

### 8.33 إعادة حالة الوحدات بعد TRUNCATE

- `TRUNCATE TABLE contracts CASCADE` لا يُفعّل الـ Trigger لتحديث حالة الوحدات
- بعد أي TRUNCATE للعقود يجب تشغيل:
  ```sql
  UPDATE public.units SET status = 'available' WHERE status = 'occupied';
  ```

### 8.34 total_amount في invoices — Generated Column

- `total_amount = amount + tax_amount` مُحسوب تلقائياً في DB
- **لا تُدرج `total_amount` في أي INSERT على جدول invoices** → خطأ 428C9
- الصحيح:
  ```ts
  await (supabase.from('invoices') as any).insert({
    amount, tax_amount: 0, due_date, status: 'pending',
    // ❌ لا total_amount هنا
  })
  ```

---

## 26. صفحة تفاصيل المستأجر (مكتملة — 2026-04-22)

### الملفات المُنشأة أو المُعدَّلة

| الملف | الحالة | الوصف |
|---|---|---|
| `apps/web/app/(dashboard)/dashboard/tenants/[id]/page.tsx` | جديد | Server Component — 3 استعلامات متوازية (tenant + contracts + invoices) |
| `apps/web/components/tenants/TenantDetailClient.tsx` | جديد | Client Component — 5 أقسام كاملة |
| `apps/web/app/(dashboard)/dashboard/tenants/actions.ts` | معدَّل | أُضيفت 3 server actions جديدة |
| `apps/web/components/tenants/TenantsClient.tsx` | معدَّل | اسم المستأجر أصبح Link للتفاصيل |
| `apps/web/components/invoices/InvoicesClient.tsx` | معدَّل | prop `defaultSearch` لتهيئة فلتر البحث |
| `apps/web/app/(dashboard)/dashboard/invoices/page.tsx` | معدَّل | يقرأ `searchParams.search` ويمرره لـ InvoicesClient |

### بنية صفحة التفاصيل `/dashboard/tenants/[id]`

```
Breadcrumb: المستأجرون ← اسم المستأجر
Header: اسم + حالة + زر "تعديل البيانات" (يفتح TenantFormDialog)
زر رجوع: router.back() — يحافظ على الفلترة السابقة

القسم 1 — المعلومات الشخصية:
  - الاسم الكامل، رقم الهوية، رقم الموبايل (tel:), الإيميل (mailto:), العنوان

القسم 2 — العقود:
  - جدول: الوحدة + اسم العقار، البداية، النهاية، الإيجار، الحالة
  - الضغط على أي صف → /dashboard/contracts/[id]

القسم 3 — الفواتير (آخر 5):
  - رقم الفاتورة، النوع، المبلغ، تاريخ الاستحقاق، الحالة
  - رابط "عرض كل الفواتير ←" → /dashboard/invoices?search={full_name}
  - InvoicesClient يقرأ ?search= ويهيئ فلتر البحث تلقائياً

القسم 4 — المستندات:
  - رفع: PDF/JPG/PNG عبر file input مخفي → uploadTenantDocumentForDetail()
  - عرض: اسم الملف + نوعه (badge ملوّن) + تاريخ الرفع (من timestamp الـ filename)
  - تحميل: رابط target="_blank"
  - حذف: deleteTenantDocumentForDetail() — يحذف من DB + Supabase Storage
  - الـ state محلي (optimistic) + router.refresh() بعد كل عملية

القسم 5 — الملاحظات:
  - Textarea مع auto-save بعد 800ms (debounce بـ setTimeout)
  - مؤشر "جاري الحفظ..." / "تم الحفظ" يظهر أثناء الحفظ وبعده
```

### Server Actions المضافة (tenants/actions.ts)

```ts
saveTenantNotes(tenantId, notes)            // حفظ الملاحظات
uploadTenantDocumentForDetail(tenantId, fd) // رفع ملف + تحديث documents[]
deleteTenantDocumentForDetail(tenantId, url) // حذف من DB + Storage
```

### 8.23 TenantsClient — الاسم كـ Link وليس الصف كاملاً

- استخدام `<Link href="/dashboard/tenants/{id}">` على عنصر الاسم فقط (ليس الـ `<tr>`).
- هذا أفضل UX من جعل الصف كاملاً قابلاً للضغط الذي يتعارض مع أزرار التعديل/الحذف.
- لا حاجة لـ `e.stopPropagation()` على أزرار الـ actions.
- أزرار التعديل والحذف أُزيلا من الجدول — موجودان فقط في صفحة التفاصيل.

### 8.24 InvoicesClient — defaultSearch prop

- prop اختياري `defaultSearch?: string` يهيئ `useState(defaultSearch ?? '')`.
- InvoicesPage يقرأ `searchParams.search` ويمرره — يُتيح الفلترة بالاسم عبر URL.
- الرابط من صفحة تفاصيل المستأجر: `/dashboard/invoices?search=${encodeURIComponent(tenant.full_name)}`

### 8.25 حذف المستأجر — Dialog بتأكيد كتابة الاسم

- ملف: `components/tenants/DeleteTenantDialog.tsx`
- زر الحذف موجود **فقط في صفحة التفاصيل** (`TenantDetailClient`) — لا يظهر في الجدول.
- الحذف يمر بـ 3 خطوات: فتح Dialog ← قراءة التحذير ← كتابة اسم المستأجر حرفياً.
- زر "حذف نهائياً" `disabled` ما لم يتطابق النص بالضبط مع `tenant.full_name`.
- بعد الحذف: `router.push('/dashboard/tenants')` للعودة للقائمة.

### 8.26 Server Actions — حجم الملفات

- Next.js يحدّ Server Actions بـ 1MB افتراضياً.
- تم رفع الحد إلى **10MB** في `next.config.ts`:
  ```ts
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  ```

### 8.29 إصلاح generate_monthly_invoices — payment_amount (2026-04-23)

**المشكلة:** migration 011 أعاد كتابة `generate_monthly_invoices` وكسر شيئين:
1. استخدم `monthly_rent` بدل `payment_amount` ← الفواتير تصدر بقيمة خاطئة (الإيجار الشهري بدل قيمة الدفعة الفعلية)
2. غيّر return type إلى `RETURNS integer` بينما الـ frontend يتوقع `RETURNS TABLE`

**الإصلاح — Migration 012:**
- استعاد منطق `payment_amount > 0 ? payment_amount : monthly_rent`
- استعاد skip للعقود غير الشهرية (`payment_count ≠ 12`)
- أعاد return type لـ `TABLE(contract_id, invoice_id, invoice_number, skipped, skip_reason)`
- أضاف `company_id` في الـ INSERT (من migration 011)

**القاعدة:** بعد أي migration يُعيد كتابة دالة موجودة، تحقق أن:
- return type لم يتغير
- جميع الحقول المُضافة في migrations سابقة لا تزال في الـ SELECT والـ INSERT

### 8.28 إصلاح عرض المستأجر في صفحة العقود (2026-04-23)

- **المشكلة:** جدول العقود كان يعرض `full_name` أساسياً و`phone` ثانوياً.
- **الإصلاح:**
  - `contracts/page.tsx`: أُضيف `company_name` لحقول الـ tenant في الـ select query.
  - `ContractsClient.tsx` — النوع: `Pick<Tenant, 'id' | 'full_name' | 'company_name' | 'phone'>`.
  - `ContractsClient.tsx` — الجدول: `company_name || full_name` بخط عريض، `full_name` أسفله إن وُجدت شركة.
  - `ContractsClient.tsx` — فلتر المستأجرين: يعرض `company_name || full_name` في القائمة المنسدلة.
- نفس المنطق الموحّد: `company_name || full_name` في كل واجهات المستأجرين.

### 8.27 اسم الشركة كحقل أساسي في المستأجرين

- `company_name` أصبح الحقل الأساسي في كل واجهات المستأجرين.
- المنطق الموحّد: `company_name || full_name` في كل مكان.
- **TenantFormDialog**: `company_name` أول حقل، label = "اسم الشركة / المستأجر *"، `full_name` label = "الاسم الكامل للممثل *".
- **TenantsClient**: `company_name` بخط عريض، `full_name` أسفله بخط صغير.
- **الفرز**: يرتّب بـ `company_name || full_name`.
- **TenantDetailClient**: العنوان `h1` هو `company_name`، `full_name` كـ subtitle.
- **Breadcrumb + generateMetadata**: يستخدم `company_name || full_name`.
