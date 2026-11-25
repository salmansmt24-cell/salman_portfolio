import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
 return {rules:[{userAgent:"*",allow:"/",disallow:["/admin","/api/"]}],sitemap:"https://jssalman.vercel.app/sitemap.xml",host:"https://jssalman.vercel.app"};
}