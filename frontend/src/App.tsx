// App's job here is the route tree. The actual layout lives in
// AppShell, and the data router setup (BrowserRouter) lives one
// level up in main.tsx so tests/storybook could mount <App/>
// inside a memory router if we ever want that.
import { Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { RequireAuth } from "@/auth/RequireAuth";
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { MapView } from "@/pages/MapView";
import { Schedule } from "@/pages/Schedule";
import { History } from "@/pages/History";
import { Track } from "@/pages/Track";
import { NotFound } from "@/pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="map" element={<MapView />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="history" element={<History />} />
        <Route
          path="track"
          element={
            <RequireAuth roles={["driver"]}>
              <Track />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}