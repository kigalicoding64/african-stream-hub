import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NotFoundPage } from "./not-found";

const SITE_URL = "https://elscholarship.com";
const OG_IMAGE = `${SITE_URL}/elscholaship-logo.jpg`;
const ADSENSE_CLIENT = "ca-pub-9065960621746429";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },

      /* Primary Brand & Target Keyword Title */
      {
        title:
          "ElScholarship — Fully Funded Global Scholarships, TVET Grants & University Mobility 2026",
      },

      /* Comprehensive Targeted Keywords (TVET, ICT, Engineering, Agri-Tech, TVET Rwanda) */
      {
        name: "keywords",
        content:
          "ElScholarship, El Scholarship, TVET scholarships Rwanda, Level 5 diploma scholarships, Level 6 advanced diploma grants, Kavumu Technical Secondary School scholarships, WDA scholarships, REB scholarships, Computer Systems and Architecture scholarships, software engineering grants, full stack developer scholarships, microcontrollers and embedded systems funding, computer networking scholarships, cybersecurity study grants, cloud computing scholarships, AI and machine learning scholarships, web development grants, robotics engineering scholarships, mechatronics grants, electrical engineering scholarships, electronics study grants, telecommunications engineering funding, agri-tech scholarships, satellite agriculture grants, smart farming fellowships, precision farming fellowships, graphic design scholarships, UI UX design grants, digital media production funding, audio production scholarships, fully funded scholarships 2026, university grants Rwanda, undergraduate scholarships, master's stipends, PhD fellowships, global academic mobility, study abroad grants",
      },

      /* Meta Description */
      {
        name: "description",
        content:
          "ElScholarship is the premier global academic mobility platform for TVET graduates, ICT developers, engineers, and researchers seeking fully funded university grants, living stipends, and international scholarships.",
      },

      /* Search Engine Directives */
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "author", content: "ElScholarship Team" },
      { name: "google-adsense-account", content: ADSENSE_CLIENT },

      /* OpenGraph Meta Tags (WhatsApp, Facebook, LinkedIn) */
      { property: "og:site_name", content: "ElScholarship" },
      { property: "og:type", content: "website" },
      {
        property: "og:title",
        content: "ElScholarship — Verified TVET & Global University Scholarships",
      },
      {
        property: "og:description",
        content:
          "Access thousands of fully funded scholarships, living stipends, and technical study grants on ElScholarship.",
      },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:url", content: SITE_URL },

      /* Twitter Meta Tags */
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ElScholarship | Global TVET & Academic Mobility" },
      {
        name: "twitter:description",
        content: "Apply for verified global scholarships, degree progression grants, and living allowances.",
      },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "canonical", href: SITE_URL },
    ],
    scripts: [
      /* Google AdSense Script */
      {
        async: true,
        src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`,
        crossOrigin: "anonymous",
      },

      /* -------------------------------------------------------------
         STEP 1: ADCASH LIBRARY SCRIPT
         Replace YOUR_ADCASH_LIB_ID with your actual Adcash library ID or URL
         ------------------------------------------------------------- */
      {
        type: "text/javascript",
        src: "//acscdn.com/script/aclib.js", // Replace with exact URL provided by Adcash
        async: true,
      },

      /* -------------------------------------------------------------
         STEP 2: ADCASH TAG SCRIPT
         Replace the inner code with the exact JS snippet from your Adcash dashboard
         ------------------------------------------------------------- */
      {
        type: "text/javascript",
        children: `
          aclib.runAutoTag({
            zoneId: 'pb4p6ccru1'
          });
        `,
      },

      /* Structured Data (JSON-LD Organization Schema) */
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "ElScholarship",
          "alternateName": ["El Scholarship", "Elysian Grants"],
          "url": SITE_URL,
          "logo": OG_IMAGE,
          "description": "Global academic mobility directory indexing fully funded scholarships, TVET grants, and university stipends.",
        }),
      },
    ],
  }),
  notFoundComponent: NotFoundPage,
  shellComponent: RootShell,
  component: RootComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-full flex-col bg-slate-50 antialiased dark:bg-slate-950">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1 shrink-0">
          <Outlet />
        </main>
        <SiteFooter />
        <Toaster position="top-right" richColors />
      </div>
    </QueryClientProvider>
  );
}
