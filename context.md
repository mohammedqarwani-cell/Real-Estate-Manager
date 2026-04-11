# context.md — توثيق مشروع Real Estate Manager

**آخر تحديث:** 2026-04-10 — إضافة نظام إدارة الصيانة الكامل  
**المسار:** `C:\Projects\real-estate-manager\`

---

## 1. نظرة عامة

نظام إدارة عقارات متكامل (Monorepo) يشمل تطبيق ويب وتطبيق جوال. يُستخدم لإدارة العقارات والوحدات والمستأجرين والعقود والفواتير وطلبات الصيانة وحجوزات قاعات الاجتماعات.

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
│   │   │   │   ├── InvoicesClient.tsx      # جدول + بحث + فلترة + توليد شهري + إلغاء
│   │   │   │   ├── InvoiceFormDialog.tsx   # Dialog إنشاء فاتورة يدوية
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
│   │   └── 007_maintenance_realtime.sql
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
| `contracts` | عقود الإيجار | `unit_id, tenant_id, start_date, end_date, monthly_rent, security_deposit, payment_day` |
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
generate_monthly_invoices(year, month) -- يُولّد فواتير الإيجار لجميع العقود الفعّالة (Migration 005)
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
| `/dashboard/tenants` | إدارة المستأجرين | جدول المستأجرين |
| `/dashboard/contracts` | إدارة العقود | جدول العقود |
| `/dashboard/invoices` | الفواتير والمدفوعات | FinancialOverview + Bar chart + جدول فواتير كامل |
| `/dashboard/maintenance` | طلبات الصيانة | MaintenanceStats + MaintenanceClient (جدول + Kanban) |
| `/dashboard/bookings` | حجوزات القاعات | جدول الحجوزات |
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
```

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

## 19. ما لم يُنجز بعد

- [ ] صفحة `access_denied` مخصصة بدلاً من redirect صامت
- [ ] تحسين الأداء: تخزين الدور في JWT custom claims
- [ ] تطبيق الجوال (هيكل فارغ حتى الآن)
- [ ] إعداد Supabase Edge Functions أو pg_cron لـ `mark_overdue_invoices()` تلقائياً كل يوم
- [ ] إعداد Supabase Edge Functions أو pg_cron لـ `generate_monthly_invoices()` تلقائياً أول كل شهر
- [ ] صفحة الحجوزات (bookings) — هيكل موجود لكن بدون تطبيق
- [ ] اختبارات (لا توجد بعد)
