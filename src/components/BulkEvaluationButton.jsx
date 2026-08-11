import { useState } from "react";
import { bulkEvaluateAndLog } from "../services/qaApi";

const BulkEvaluationButton = ({ selectedPetitions, onRefreshQueue }) => {
  const [loading, setLoading] = useState(false);

  const handleBulkEvaluation = async () => {
    if (!selectedPetitions || selectedPetitions.length === 0) {
      alert("Please select at least one petition to evaluate.");
      return;
    }

    setLoading(true);
    try {
      const result = await bulkEvaluateAndLog(selectedPetitions);

      if (result.success) {
        const { successful, failed } = result.summary;
        const logged = result.loggingSummary.successfulLogs;

        alert(
          `Bulk Complete!\n- Evaluated Successfully: ${successful}\n- Failed: ${failed}\n- Logged Externally: ${logged}`,
        );

        // Trigger parent component to reload the queue/table data
        if (onRefreshQueue) onRefreshQueue();
      }
    } catch (error) {
      alert(`Bulk Evaluation Failed: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleBulkEvaluation}
      disabled={loading || selectedPetitions.length === 0}
      className={`px-4 py-2 rounded font-medium text-white transition ${
        loading || selectedPetitions.length === 0
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-green-600 hover:bg-green-700"
      }`}
    >
      {loading
        ? "Processing Chunks..."
        : `Bulk Evaluate Selected (${selectedPetitions.length})`}
    </button>
  );
};

export default BulkEvaluationButton;
