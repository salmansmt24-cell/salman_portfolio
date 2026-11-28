import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
 return {rules:[{userAgent:"*",allow:"/",disallow:["/admin","/api/","/team"]}],sitemap:"https://www.jssalman.online/sitemap.xml",host:"https://www.jssalman.online"};
}