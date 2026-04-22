import { getInvitationByToken } from './actions'
import { AcceptInviteForm }     from './AcceptInviteForm'

export const metadata = { title: 'قبول الدعوة' }

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function AcceptInvitePage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">رابط غير صالح</h1>
          <p className="text-muted-foreground">هذا الرابط غير صحيح أو لم يعد صالحاً.</p>
        </div>
      </div>
    )
  }

  const invitation = await getInvitationByToken(token)

  if (!invitation) {
    return (
      <div dir="rtl" className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">الدعوة منتهية الصلاحية</h1>
          <p className="text-muted-foreground">
            هذا الرابط منتهي الصلاحية أو تم استخدامه بالفعل. تواصل مع المدير للحصول على دعوة جديدة.
          </p>
        </div>
      </div>
    )
  }

  const ROLE_LABELS: Record<string, string> = {
    manager:      'مدير',
    accountant:   'محاسب',
    maintenance:  'فني صيانة',
    receptionist: 'موظف استقبال',
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-4 bg-muted/20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">مرحباً بك في الفريق!</h1>
          <p className="text-muted-foreground mt-2">
            تمت دعوتك للانضمام إلى{' '}
            <span className="font-semibold text-foreground">
              {invitation.company?.name ?? 'الشركة'}
            </span>{' '}
            بصفة{' '}
            <span className="font-semibold text-foreground">
              {ROLE_LABELS[invitation.role] ?? invitation.role}
            </span>
          </p>
        </div>

        <AcceptInviteForm
          token={token}
          email={invitation.email}
          defaultName={invitation.employee?.name ?? ''}
        />
      </div>
    </div>
  )
}
