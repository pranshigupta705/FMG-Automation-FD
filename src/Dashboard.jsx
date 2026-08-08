import { useGetDashboardDataQuery } from "./store/apiSlice";

function DashboardMetrics() {
  // Pass a specific date 'YYYY-MM-DD' or leave empty for today
  const { data, isLoading, isError } = useGetDashboardDataQuery("2026-08-01");

  if (isLoading) {
    return (
      <div className="text-slate-500 font-medium p-4">
        Loading aggregated metrics...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-rose-500 font-medium p-4">
        Failed to load dashboard data.
      </div>
    );
  }

  // Safely access the data
  const summary = data?.summary || {};

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {/* Firsty Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
          Firsty Queries
        </h3>
        <p className="text-3xl font-extrabold text-indigo-600 mt-2">
          {summary.totalFirstyQueries || 0}
        </p>
      </div>

      {/* BTClient Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
          BTClient Queries
        </h3>
        <p className="text-3xl font-extrabold text-indigo-600 mt-2">
          {summary.totalBtClientQueries || 0}
        </p>
      </div>

      {/* Global Observations Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
          Global Observations
        </h3>
        <p className="text-3xl font-extrabold text-indigo-600 mt-2">
          {summary.totalObservations || 0}
        </p>
      </div>
    </div>
  );
}

// ✨ THIS SINGLE LINE FIXES BOTH ERRORS ✨
export default DashboardMetrics;
