import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AuthPage from "@/routes/auth";
import AppShell from "@/routes/_authenticated/app";
import ProtectedRoute from "@/routes/_authenticated/route";
import Landing from "@/routes/index";
import NotFound from "@/routes/not-found";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in" element={<AuthPage mode="signin" />} />
        <Route path="/sign-up" element={<AuthPage mode="signup" />} />
        <Route path="/auth" element={<Navigate to="/sign-in" replace />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AppShell />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
