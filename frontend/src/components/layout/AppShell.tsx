// Persistent layout wrapper. Header is sticky at top, Footer pinned at
// bottom, page content fills the middle. React Router's <Outlet/>
// renders the matched route here.
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { OfflineBanner } from "./OfflineBanner";

export function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-sewanee-lavender">
      <Header />
      <OfflineBanner />  
      <main className="flex-grow w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}