import { Building2 } from 'lucide-react'
import { CompanySetupForm } from '@/components/onboarding/CompanySetupForm'

type Props = {
  searchParams: Promise<{ plan?: string }>
}

export default async function OnboardingPage({ searchParams }: Props) {
  const params = await searchParams
  const initialPlan = params.plan === 'pro' ? 'pro' : 'free'

  return (
    <div className="w-full max-w-lg">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">مرحباً بك في النظام!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          لبدء استخدام النظام، أنشئ ملف شركتك في خطوة واحدة
        </p>
      </div>

      {/* Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-5">إعداد الشركة</h2>
        <CompanySetupForm initialPlan={initialPlan} />
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        بإنشاء الشركة، ستصبح مدير النظام وبإمكانك إضافة موظفين لاحقاً
      </p>
    </div>
  )
}
