import AcceptForm from "./accept-form";
export const dynamic="force-dynamic";
export default async function AcceptInvitationPage({searchParams}:{searchParams:Promise<{token?:string}>}){
 const params=await searchParams;
 return <AcceptForm token={params.token||""}/>;
}
