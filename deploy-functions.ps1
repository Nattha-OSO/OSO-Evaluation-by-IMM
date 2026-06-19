# ============================================================
#  deploy-functions.ps1
#  ติดตั้ง/อัปเดต Supabase Edge Functions ทั้งหมดของระบบ
#    - register     (หน้า public ลงทะเบียน -> ต้อง --no-verify-jwt)
#    - admin-users  (จัดการผู้ใช้ + อนุมัติ + อีเมลแจ้งผู้ใช้)
#    - send-report  (ส่งรายงานทางอีเมล)
#  วิธีใช้:  เปิด PowerShell -> รันไฟล์นี้ -> วาง Access Token เมื่อถูกถาม
#    cd "D:\Ai Tools\Claude\OSO Evaluation by IMM\Github"
#    .\deploy-functions.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ProjectRef = "hokuuilqvfdeekchqelz"

# ย้ายไปโฟลเดอร์ที่มีไฟล์สคริปต์นี้ (ต้องมีโฟลเดอร์ supabase\functions อยู่ข้างใน)
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path ".\supabase\functions\register\index.ts")) {
  Write-Host "ERROR: ไม่พบ supabase\functions\register\index.ts — ตรวจว่ารันไฟล์นี้จากโฟลเดอร์ Github" -ForegroundColor Red
  exit 1
}

# ---- รับ Access Token ----
if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
  Write-Host ""
  Write-Host "ต้องใช้ Supabase Access Token (ขึ้นต้น sbp_...)" -ForegroundColor Cyan
  Write-Host "สร้าง/คัดลอกได้ที่:  https://supabase.com/dashboard/account/tokens" -ForegroundColor Cyan
  Write-Host "(วางแล้วกด Enter — ตัวอักษรจะถูกซ่อนเพื่อความปลอดภัย)" -ForegroundColor DarkGray
  $sec = Read-Host "วาง Access Token ที่นี่" -AsSecureString
  $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $env:SUPABASE_ACCESS_TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

$tok = $env:SUPABASE_ACCESS_TOKEN
if ([string]::IsNullOrWhiteSpace($tok) -or -not $tok.StartsWith("sbp_")) {
  Write-Host "ERROR: Token ไม่ถูกต้อง (ต้องขึ้นต้น sbp_ และยาว ~44 ตัว) — ที่ได้มายาว $($tok.Length) ตัว" -ForegroundColor Red
  Write-Host "ระวัง: อย่าวางข้อความตัวอย่าง/placeholder — ต้องเป็นโทเค็นจริงจากหน้า Account > Access Tokens" -ForegroundColor Yellow
  exit 1
}
Write-Host "Token OK (length $($tok.Length))" -ForegroundColor Green

# ---- deploy ทีละฟังก์ชัน ----
Write-Host "`n[1/3] deploy register (--no-verify-jwt) ..." -ForegroundColor Cyan
npx --yes supabase functions deploy register --project-ref $ProjectRef --use-api --no-verify-jwt

Write-Host "`n[2/3] deploy admin-users ..." -ForegroundColor Cyan
npx --yes supabase functions deploy admin-users --project-ref $ProjectRef --use-api

Write-Host "`n[3/3] deploy send-report ..." -ForegroundColor Cyan
npx --yes supabase functions deploy send-report --project-ref $ProjectRef --use-api

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host " เสร็จสิ้น! ตรวจได้ที่ Dashboard > Edge Functions" -ForegroundColor Green
Write-Host "   ควรเห็น: register, admin-users, send-report" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
