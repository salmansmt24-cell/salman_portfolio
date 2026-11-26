import ResetPasswordForm from "./reset-password-form";
export const dynamic="force-dynamic";
export default async function ResetPasswordPage({searchParams}:{searchParams:Promise<{token?:string}>}){const p=await searchParams;return <ResetPasswordForm token={p.token||""}/>;}
