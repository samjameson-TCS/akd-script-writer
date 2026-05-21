import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Generate from "./pages/Generate";
import History from "./pages/History";
import KnowledgeBase from "./pages/KnowledgeBase";
import ResearchLibrary from "./pages/ResearchLibrary";
import LawsuitUpdates from "./pages/LawsuitUpdates";
import Dashboard from "./pages/Dashboard";
import BuyerSpecs from "./pages/BuyerSpecs";
import HooksLibrary from "./pages/HooksLibrary";
function Router() {
  return (
    <Switch>
      <Route path="/" component={Generate} />
      <Route path="/history" component={History} />
      <Route path="/knowledge-base" component={KnowledgeBase} />
      <Route path="/research" component={ResearchLibrary} />
      <Route path="/updates" component={LawsuitUpdates} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/buyer-specs" component={BuyerSpecs} />
      <Route path="/hooks" component={HooksLibrary} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
