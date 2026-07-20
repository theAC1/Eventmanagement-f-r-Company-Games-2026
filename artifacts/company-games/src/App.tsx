import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Router as WouterRouter } from "wouter";
import { AuthProvider, RequireAuth } from "@/lib/auth-context";
import { lazy, Suspense } from "react";

// Pages
import HomePage from "@/app/page";
import LoginPage from "@/app/login/page";
import ScoreboardPage from "@/app/scoreboard/page";

// Layouts
import AdminLayout from "@/app/admin/layout";
import RefereeLayout from "@/app/referee/layout";

// Admin pages (lazy loaded)
const AdminGamesPage = lazy(() => import("@/app/admin/page"));
const AdminGameNewPage = lazy(() => import("@/app/admin/games/new/page"));
const AdminGameDetailPage = lazy(() => import("@/app/admin/games/[id]/page"));
const AdminTeamsPage = lazy(() => import("@/app/admin/teams/page"));
const AdminTeamDetailPage = lazy(() => import("@/app/admin/teams/[id]/page"));
const AdminTeamBadgePage = lazy(() => import("@/app/admin/teams/[id]/badge/page"));
const AdminMaterialsPage = lazy(() => import("@/app/admin/materials/page"));
const AdminMaterialNewPage = lazy(() => import("@/app/admin/materials/new/page"));
const AdminMaterialDetailPage = lazy(() => import("@/app/admin/materials/[id]/page"));
const AdminSchedulePage = lazy(() => import("@/app/admin/schedule/page"));
const AdminSituationsplanPage = lazy(() => import("@/app/admin/situationsplan/page"));
const AdminEinsatzplanPage = lazy(() => import("@/app/admin/einsatzplan/page"));
const AdminGamedayPage = lazy(() => import("@/app/admin/gameday/page"));
const AdminGamedayPrintPage = lazy(() => import("@/app/admin/gameday/print/page"));
const AdminUsersPage = lazy(() => import("@/app/admin/users/page"));
const AdminKvpPage = lazy(() => import("@/app/admin/kvp/page"));

// Referee pages (lazy loaded)
const RefereeIndexPage = lazy(() => import("@/app/referee/page"));
const RefereeGamePage = lazy(() => import("@/app/referee/[slug]/page"));
const RefereeCheckinPage = lazy(() => import("@/app/referee/[slug]/checkin/page"));
const RefereeEingabePage = lazy(() => import("@/app/referee/[slug]/eingabe/page"));
const RefereeLivePage = lazy(() => import("@/app/referee/[slug]/live/page"));
const RefereeBestaetigungPage = lazy(() => import("@/app/referee/[slug]/bestaetigung/page"));

// Team portal
const TeamPortalPage = lazy(() => import("@/app/team/[token]/page"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
    <div className="text-zinc-500">Laden...</div>
  </div>
);

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={HomePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/scoreboard" component={ScoreboardPage} />

      {/* Team portal - no auth */}
      <Route path="/team/:token">
        {(params) => (
          <Suspense fallback={<PageLoader />}>
            <TeamPortalPage />
          </Suspense>
        )}
      </Route>

      {/* Admin routes */}
      <Route path="/admin">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminGamesPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/games/new">
        {() => (
          <RequireAuth minRole="ORGA">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminGameNewPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/games/:id">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminGameDetailPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/teams">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminTeamsPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/teams/:id/badge">
        {() => (
          <RequireAuth minRole="ORGA">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminTeamBadgePage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/teams/:id">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminTeamDetailPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/materials/new">
        {() => (
          <RequireAuth minRole="ORGA">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminMaterialNewPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/materials/:id">
        {() => (
          <RequireAuth minRole="ORGA">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminMaterialDetailPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/materials">
        {() => (
          <RequireAuth minRole="ORGA">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminMaterialsPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/schedule">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminSchedulePage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/einsatzplan">
        {() => (
          <RequireAuth minRole="ORGA">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminEinsatzplanPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/situationsplan">
        {() => (
          <RequireAuth minRole="ORGA">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminSituationsplanPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/gameday/print">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminGamedayPrintPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/gameday">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminGamedayPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/users">
        {() => (
          <RequireAuth minRole="ADMIN">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/admin/kvp">
        {() => (
          <RequireAuth minRole="ADMIN">
            <AdminLayout>
              <Suspense fallback={<PageLoader />}><AdminKvpPage /></Suspense>
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>

      {/* Referee routes */}
      <Route path="/referee">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <RefereeLayout>
              <Suspense fallback={<PageLoader />}><RefereeIndexPage /></Suspense>
            </RefereeLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/referee/:slug/checkin">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <RefereeLayout>
              <Suspense fallback={<PageLoader />}><RefereeCheckinPage /></Suspense>
            </RefereeLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/referee/:slug/eingabe">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <RefereeLayout>
              <Suspense fallback={<PageLoader />}><RefereeEingabePage /></Suspense>
            </RefereeLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/referee/:slug/live">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <RefereeLayout>
              <Suspense fallback={<PageLoader />}><RefereeLivePage /></Suspense>
            </RefereeLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/referee/:slug/bestaetigung">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <RefereeLayout>
              <Suspense fallback={<PageLoader />}><RefereeBestaetigungPage /></Suspense>
            </RefereeLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/referee/:slug">
        {() => (
          <RequireAuth minRole="SCHIEDSRICHTER">
            <RefereeLayout>
              <Suspense fallback={<PageLoader />}><RefereeGamePage /></Suspense>
            </RefereeLayout>
          </RequireAuth>
        )}
      </Route>

      {/* 404 */}
      <Route>
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold">404</h1>
            <p className="text-zinc-400 mt-2">Seite nicht gefunden</p>
            <a href="/" className="mt-4 inline-block text-sm text-zinc-400 hover:text-white">Zur Startseite</a>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
