import {createHmac,timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
const NAME="salman_private_vault";
function signature(value:string){const secret=process.env.ADMIN_SESSION_SECRET;if(!secret||secret.length<32)throw new Error("Session secret missing");return createHmac("sha256",secret).update(value).digest("base64url")}
export async function isPrivateVaultUnlocked(){const jar=await cookies();const token=jar.get(NAME)?.value||"";const [value,sig,...extra]=token.split(".");if(value!=="unlocked"||!sig||extra.length)return false;const expected=signature(value);const a=Buffer.from(sig),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b)}
export async function setPrivateVaultUnlocked(open:boolean){const jar=await cookies();jar.set(NAME,open?"unlocked."+signature("unlocked"):"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:open?60*60*8:0})}
