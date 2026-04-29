import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import Classes from "./pages/Classes";
import Teachers from "./pages/Teachers";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Scan from "./pages/Scan";
import Permissions from "./pages/Permissions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner position="top-center" />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="scan" element={<Scan />} />
              <Route path="permissions" element={<Permissions />} />
              <Route path="students" element={<ProtectedRoute requireAdmin><Students /></ProtectedRoute>} />
              <Route path="students/:id" element={<ProtectedRoute requireAdmin><StudentDetail /></ProtectedRoute>} />
              <Route path="classes" element={<ProtectedRoute requireAdmin><Classes /></ProtectedRoute>} />
              <Route path="teachers" element={<ProtectedRoute requireAdmin><Teachers /></ProtectedRoute>} />
              <Route path="attendance" element={<Attendance />} />
              <Route path="reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
