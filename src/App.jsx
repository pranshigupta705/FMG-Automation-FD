import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import {
  useGetLivePetitionsQuery,
  useEvaluatePetitionMutation,
  useBulkEvaluateAndLogMutation,
} from "./store/apiSlice";

// Initialize socket connection to your standalone backend
const socket = io("http://localhost:3000");

const formatTime = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const THEME = {
  page: "min-h-screen bg-slate-50 dark:bg-[#0d0f17] p-4 sm:p-8 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300",
  headerCard:
    "mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white dark:bg-[#111827] p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 gap-4 transition-colors",
  tableCard:
    "mb-8 overflow-hidden rounded-xl border border-slate-200 dark:border-[#2a2d3d] bg-white dark:bg-[#1e2030] shadow-sm transition-colors w-full",
  modalOverlay:
    "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4",
  modalCard:
    "w-full max-w-4xl rounded-2xl bg-white dark:bg-[#0d0f17] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]",
  modalButton:
    "rounded-lg bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors",
};

function App() {
  const [authToken] = useState("YOUR_EMPLOYEE_TOKEN_HERE");
  const apiToken = authToken || import.meta.env.VITE_GLOBAL_API_TOKEN || "";

  const [manualId, setManualId] = useState("");
  const [results, setResults] = useState({});
  const [loadingRows, setLoadingRows] = useState({});
  const [selectedPetitionId, setSelectedPetitionId] = useState("");
  const [conversationMessages, setConversationMessages] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState([]);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false);

  // ✨ BULK SELECTION STATE ✨
  const [selectedPetitionIds, setSelectedPetitionIds] = useState([]);

  // Form State
  const [petitionNumber, setPetitionNumber] = useState("");
  const [errorTypes, setErrorTypes] = useState([]);
  const [agentName, setAgentName] = useState("");
  const [observationDescription, setObservationDescription] = useState("");
  const [qaScore, setQaScore] = useState(100);

  // View State
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((current) => !current);
  };

  // RTK Query Hooks
  const {
    data: response,
    isLoading: isFetchingList,
    refetch,
  } = useGetLivePetitionsQuery(selectedDate);

  const petitions = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response)
      ? response
      : [];

  const [evaluatePetition] = useEvaluatePetitionMutation();

  const filteredPetitions = petitions.filter((petition) => {
    if (statusFilter === "ALL") return true;
    const currentStatus = (petition.status || "PENDING").toUpperCase();
    return currentStatus === statusFilter;
  });

  // ✨ BULK SELECTION HANDLERS ✨
  const handleToggleSelect = (petitionId) => {
    setSelectedPetitionIds((prev) =>
      prev.includes(petitionId)
        ? prev.filter((id) => id !== petitionId)
        : [...prev, petitionId],
    );
  };

  const handleToggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedPetitionIds(
        filteredPetitions.map((p) => p.petitionId || p.id),
      );
    } else {
      setSelectedPetitionIds([]);
    }
  };

  const selectedPetitionsData = filteredPetitions.filter((p) =>
    selectedPetitionIds.includes(p.petitionId || p.id),
  );

  const populateFormFromEvaluation = (
    petitionId,
    evaluation,
    petitionObject = {},
  ) => {
    if (!petitionId || !evaluation) return;

    setSelectedPetitionId(petitionId);
    setPetitionNumber(petitionId);

    setErrorTypes(
      Array.isArray(evaluation.errorTypes)
        ? evaluation.errorTypes
        : evaluation.errorTypes
          ? [evaluation.errorTypes]
          : ["CRITICAL"],
    );

    const extractedAgentName =
      evaluation.agentName ||
      evaluation.evaluation?.agentName ||
      petitionObject.assignedAgent ||
      petitionObject.agentName ||
      "Unassigned";

    setAgentName(extractedAgentName);

    setObservationDescription(
      evaluation.observationSummary ||
        evaluation.reasoning ||
        evaluation.observation ||
        "",
    );
    setQaScore(
      typeof evaluation.qaScore === "number" ? evaluation.qaScore : 45,
    );
  };

  // WebSocket Listeners
  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected to WebSocket server ID:", socket.id);
    });

    socket.on("petitionEvaluated", (data) => {
      const targetId = data.petitionId || data.result?.metadata?.petitionId;
      const evaluation = data.result || data.evaluation || data;
      if (targetId) {
        setResults((prev) => ({ ...prev, [targetId]: evaluation }));
        populateFormFromEvaluation(targetId, evaluation);
      }
    });

    return () => {
      socket.off("connect");
      socket.off("petitionEvaluated");
    };
  }, []);

  const handleEvaluate = async (petitionId) => {
    if (!petitionId) return;
    setLoadingRows((prev) => ({ ...prev, [petitionId]: true }));
    try {
      const evaluateResponse = await evaluatePetition({
        petitionId,
        token: apiToken,
      }).unwrap();
      const evaluation = evaluateResponse?.data || evaluateResponse;
      setResults((prev) => ({ ...prev, [petitionId]: evaluation }));

      const petitionObj =
        petitions.find((p) => (p.petitionId || p.id) === petitionId) || {};
      populateFormFromEvaluation(petitionId, evaluation, petitionObj);
    } catch (error) {
      alert(
        `Failed to evaluate ${petitionId}. Ensure your backend is running.`,
      );
      console.error(error);
    } finally {
      setLoadingRows((prev) => ({ ...prev, [petitionId]: false }));
    }
  };

  const extractTranscriptMessages = (payload) => {
    const messages =
      payload?.messages ||
      payload?.interactionData?.messages ||
      payload?.chatTranscript ||
      payload?.conversation?.messages ||
      payload?.transcript ||
      [];
    return Array.isArray(messages) ? messages : [];
  };

  const handleSelectPetition = (petitionObject) => {
    if (!petitionObject) return;
    setSelectedPetitionId(petitionObject.petitionId || petitionObject.id || "");
    setConversationMessages(extractTranscriptMessages(petitionObject));
  };

  const handleViewClick = async (petitionId) => {
    try {
      setIsTranscriptModalOpen(true);
      setIsTranscriptLoading(true);
      setSelectedTranscript([]);
      setConversationMessages([]);

      const response = await fetch(
        `http://localhost:3000/api/v1/qa/conversation/${petitionId}`,
      );

      const data = await response.json();
      const messages =
        data?.messages ||
        data?.conversation?.messages ||
        data?.transcript ||
        data?.chatTranscript ||
        [];

      if (!Array.isArray(messages) || messages.length === 0) {
        setSelectedTranscript([
          {
            role: "System",
            name: "System",
            text: "No transcript messages were found.",
            time: "",
          },
        ]);
        return;
      }

      const formattedArray = messages.map((message) => ({
        role: message.senderRole || message.role || "Unknown",
        name: message.senderName || message.name || "Unknown",
        text: message.message || message.text || "",
        time: message.timestamp
          ? new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
      }));

      setSelectedTranscript(formattedArray);
      setConversationMessages(formattedArray);
      setSelectedPetitionId(petitionId);
    } catch (error) {
      console.error("Failed to fetch transcript:", error);
      setSelectedTranscript([
        {
          role: "System",
          name: "System",
          text: "Error loading transcript.",
          time: "",
        },
      ]);
    } finally {
      setIsTranscriptLoading(false);
    }
  };

  const handleQuickCopyTranscript = async (petitionId) => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/v1/qa/conversation/${petitionId}`,
      );
      const data = await response.json();
      const messages =
        data?.messages ||
        data?.conversation?.messages ||
        data?.transcript ||
        data?.chatTranscript ||
        data?.interactionData?.messages ||
        [];

      if (!Array.isArray(messages) || messages.length === 0) {
        alert("No transcript messages found to copy.");
        return;
      }

      const transcriptText = messages
        .map((m) => {
          const timestamp = m.timestamp
            ? new Date(m.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Time";
          const speaker = m.senderRole || m.role || m.sender || "Unknown";
          const name = m.senderName || m.name || "";
          const message = m.message || m.text || m.body || "";
          return `[${timestamp}] ${speaker} (${name}): ${message}`;
        })
        .join("\n");

      await navigator.clipboard.writeText(transcriptText);
      alert(`Transcript for ${petitionId} copied to clipboard!`);
    } catch (err) {
      console.error("Quick copy failed:", err);
      alert("Unable to fetch and copy transcript.");
    }
  };

  const handleCopyTranscript = async (messages) => {
    const transcriptItems = messages || [];
    if (!transcriptItems.length) {
      alert("No transcript available to copy.");
      return;
    }

    const transcriptText = transcriptItems
      .map((m) => {
        const timestamp = m.timestamp || m.time || "Time";
        const speaker = m.role || m.sender || m.actor || "Unknown";
        const message = m.text || m.message || m.body || "";
        return `[${timestamp}] ${speaker}: ${message}`;
      })
      .join("\n");

    try {
      await navigator.clipboard.writeText(transcriptText);
      alert("Chat transcript copied to clipboard!");
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      alert("Unable to copy transcript to clipboard.");
    }
  };

  const handleAutoReport = async (petitionId) => {
    setSelectedPetitionId(petitionId);
    try {
      const res = await fetch(
        `http://localhost:3000/api/v1/qa/observations?date=${selectedDate}`,
        {
          headers: {
            ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
          },
        },
      );
      const json = await res.json();

      let match = null;
      json.data?.forEach((report) => {
        const found = report.observations?.find(
          (o) => o.petitionNumber === petitionId,
        );
        if (found) match = found;
      });

      if (match) {
        setPetitionNumber(match.petitionNumber || petitionId);
        setErrorTypes(
          Array.isArray(match.errorType)
            ? match.errorType
            : match.errorType
              ? [match.errorType]
              : ["ART Delay"],
        );
        setAgentName(match.agentName || "Unassigned");
        setObservationDescription(match.observation || "");
        setQaScore(typeof match.qaScore === "number" ? match.qaScore : 0);
        alert("Observation form auto-filled successfully!");
      } else {
        alert("No matching observation report found for this petition.");
      }
    } catch (err) {
      console.error("Auto-report fetch error:", err);
      alert("Failed to auto-fill observation report.");
    }
  };

  const handleRunAiEvaluation = async (petition) => {
    const petitionId =
      typeof petition === "object" && petition !== null
        ? petition.petitionId || petition.id || petition.petitionNumber
        : petition;

    const petitionInfo =
      typeof petition === "object" && petition !== null
        ? petition
        : petitions.find(
            (p) => (p.petitionId || p.id || p.petitionNumber) === petitionId,
          ) || {};

    if (!petitionId) {
      alert("No petition selected for AI evaluation.");
      return;
    }

    try {
      const convResponse = await fetch(
        `http://localhost:3000/api/v1/qa/conversation/${petitionId}`,
      );
      const convData = await convResponse.json();

      if (!convData.interactionData) {
        alert("No transcript available to evaluate.");
        return;
      }

      const evalPayload = {
        interactionData: convData.interactionData,
        petitionStatus:
          petitionInfo.status || petitionInfo.petitionStatus || "Pending",
        acceptedBy:
          petitionInfo.assignedAgent || petitionInfo.agentName || "Unknown",
        assignedAgent:
          petitionInfo.assignedAgent || petitionInfo.agentName || "Unknown",
        category: petitionInfo.category || "General",
      };

      const response = await fetch("http://localhost:3000/api/v1/qa/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify(evalPayload),
      });
      const json = await response.json();

      if (json.success && json.data) {
        const evalResult = json.data;
        const evaluation = evalResult.evaluation || {};

        const isDeterministic = !!evaluation.errorType;
        const aiObservations = Array.isArray(evaluation.observations)
          ? evaluation.observations
          : [];

        setPetitionNumber(petitionId);

        let extractedErrorTypes = [];
        if (isDeterministic) {
          extractedErrorTypes = [evaluation.errorType];
        } else if (aiObservations.length > 0) {
          extractedErrorTypes = aiObservations.map(
            (obs) => obs.errorType || obs.ruleId,
          );
        } else if (evalResult.errorTypes) {
          extractedErrorTypes = Array.isArray(evalResult.errorTypes)
            ? evalResult.errorTypes
            : [evalResult.errorTypes];
        } else {
          extractedErrorTypes = ["General QA"];
        }
        setErrorTypes([...new Set(extractedErrorTypes)]);

        const extractedAgentName =
          evalResult.agentName ||
          evaluation.agentName ||
          petitionInfo.assignedAgent ||
          petitionInfo.agentName ||
          "Unassigned";
        setAgentName(extractedAgentName);

        let formattedDescription = "";
        if (isDeterministic) {
          formattedDescription =
            evaluation.observation || "No observation details returned.";
        } else if (aiObservations.length > 0) {
          // ✨ PERFECT FORMATTING TEMPLATE IMPLEMENTATION ✨
          formattedDescription = aiObservations
            .map((obs) => {
              let text = `Error Type: ${obs.errorType || "General QA"}\n`;
              text += `Chat Evidence:\n`;

              if (obs.evidence && obs.evidence.length > 0) {
                obs.evidence.forEach((ev) => {
                  text += `${ev}\n`;
                });
              } else {
                text += `[No evidence provided]\n`;
              }

              text += `\nObservation:\n${obs.observation || ""}`;
              return text;
            })
            .join("\n\n------------------------------------------------\n\n");
        } else {
          formattedDescription =
            evalResult.observation ||
            evalResult.observationSummary ||
            evalResult.reasoning ||
            "No details found.";
        }
        setObservationDescription(formattedDescription);

        setQaScore(
          typeof evalResult.qaScore === "number"
            ? evalResult.qaScore
            : typeof evaluation.overallScore === "number"
              ? evaluation.overallScore
              : typeof evaluation.score === "number"
                ? evaluation.score
                : 0,
        );

        alert("AI Evaluation completed and fed into observation panel!");
      } else {
        alert("AI Evaluation returned no usable data.");
      }
    } catch (err) {
      console.error("AI Evaluation error:", err);
      alert("AI Evaluation failed.");
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      // ✨ Map to handle specific mixed-case Enums required by your backend ✨
      const exactCaseMap = {
        "ESCALATION DELAY": "Escalation Delay",
        "IN PROGRESS": "In Progress",
        "IN QUEUE": "In queue",
      };

      // Constructing the exact payload structure your backend expects
      const payload = {
        center: "69d77dabb43b8f3a2a7bf930",
        project: "6a4d3543c23feda7432054e3",
        reportDate: `${new Date().toISOString().split("T")[0]}T00:00:00.000Z`,
        observations: [
          {
            petitionNumber,
            errorType: (Array.isArray(errorTypes)
              ? errorTypes
              : [errorTypes]
            ).map((type) => {
              const upperType = type.toUpperCase().trim();
              return exactCaseMap[upperType] || upperType;
            }),
            agentName:
              !agentName || agentName.trim() === ""
                ? "Unassigned"
                : agentName.trim(),
            observation: observationDescription,
            qaScore: Number(qaScore),
          },
        ],
      };

      const response = await fetch(
        "http://localhost:3000/api/v1/qa/log-observation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );

      const json = await response.json();
      if (json.success || response.ok) {
        alert("Observation successfully pushed to the live workspace panel!");
      } else {
        alert("Error: " + (json.message || "Unable to log observation."));
      }
    } catch (err) {
      console.error("Submission error:", err);
      alert("Failed to submit observation. Please check the console.");
    }
  };

  return (
    <div className={THEME.page}>
      <div className="max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <header className={THEME.headerCard}>
          <div className="flex flex-col">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-gray-100 tracking-tight">
              FMG QA Engine
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 font-medium">
              Real-time AI evaluation dashboard with WebSocket sync
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 xl:mt-0">
            {/* Date & Status Filters */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#1e2030] p-1.5 rounded-xl border border-slate-200 dark:border-[#2a2d3d] shadow-sm transition-colors">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-gray-300 outline-none cursor-pointer [color-scheme:light] dark:[color-scheme:dark]"
              />
              <div className="w-px h-5 bg-slate-300 dark:bg-[#2a2d3d]"></div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-gray-300 outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-[#1e2030]">
                  All Status
                </option>
                <option value="PENDING" className="bg-white dark:bg-[#1e2030]">
                  Pending
                </option>
                <option
                  value="TRANSFERRED"
                  className="bg-white dark:bg-[#1e2030]"
                >
                  Transferred
                </option>
                <option value="RESOLVED" className="bg-white dark:bg-[#1e2030]">
                  Resolved
                </option>
                <option
                  value="IN PROGRESS"
                  className="bg-white dark:bg-[#1e2030]"
                >
                  In Progress
                </option>
              </select>
            </div>

            {/* Manual ID Input */}
            <div className="flex bg-slate-50 dark:bg-[#1e2030] p-1.5 rounded-xl border border-slate-200 dark:border-[#2a2d3d] shadow-sm transition-colors">
              <input
                type="text"
                placeholder="Enter Petition ID..."
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="bg-transparent px-3 py-1.5 text-sm font-medium text-slate-800 dark:text-gray-300 outline-none w-40 sm:w-48 placeholder-slate-400"
              />
              <button
                onClick={() => handleEvaluate(manualId)}
                disabled={!manualId || loadingRows[manualId]}
                className="bg-indigo-600 dark:bg-[#6b5ce7] hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
              >
                {loadingRows[manualId] ? "Testing..." : "Test ID"}
              </button>
            </div>

            <button
              onClick={refetch}
              disabled={isFetchingList}
              className="bg-white dark:bg-[#1e2030] border border-slate-200 dark:border-[#2a2d3d] hover:bg-slate-50 text-slate-700 dark:text-gray-300 font-semibold px-4 py-2 rounded-xl transition-colors text-sm shadow-sm disabled:opacity-50"
            >
              {isFetchingList ? "Syncing..." : "Refresh Queue"}
            </button>

            <button
              onClick={toggleTheme}
              className="flex items-center justify-center p-2.5 rounded-xl bg-white dark:bg-[#1e2030] border border-slate-200 dark:border-[#2a2d3d] text-slate-600 dark:text-gray-300 shadow-sm"
            >
              {isDarkMode ? "☀️" : "🌙"}
            </button>
          </div>
        </header>

        {/* TWO-COLUMN LAYOUT WRAPPER */}
        <div className="flex flex-col lg:flex-row gap-6 items-start mt-2 w-full mb-10">
          {/* LEFT COLUMN: OBSERVATION FORM */}
          <div className="w-full lg:w-[340px] xl:w-[400px] shrink-0 lg:sticky lg:top-6 z-10 transition-all">
            <div className="bg-white dark:bg-[#1e2030] border border-slate-200 dark:border-[#2a2d3d] p-6 rounded-2xl shadow-lg w-full transition-colors">
              <div className="flex flex-col gap-3 mb-6 border-b border-slate-200 dark:border-[#2a2d3d] pb-5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-gray-100">
                    Log Observation
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                    Selected:{" "}
                    <span className="font-bold text-slate-700 dark:text-gray-200">
                      {selectedPetitionId || petitionNumber || "UNKNOWN"}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleAutoReport(selectedPetitionId || petitionNumber)
                    }
                    disabled={!selectedPetitionId && !petitionNumber}
                    className="flex-1 bg-slate-50 dark:bg-[#11131e] border border-slate-200 dark:border-[#2a2d3d] hover:bg-slate-100 text-slate-700 dark:text-gray-300 font-semibold py-2 rounded-xl text-sm shadow-sm disabled:opacity-50"
                  >
                    Auto-fill
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetObj = petitions.find(
                        (p) =>
                          (p.petitionId || p.id) ===
                          (selectedPetitionId || petitionNumber),
                      );
                      handleRunAiEvaluation(
                        targetObj || selectedPetitionId || petitionNumber,
                      );
                    }}
                    disabled={!selectedPetitionId && !petitionNumber}
                    className="flex-1 bg-indigo-50 dark:bg-[#11131e] border border-indigo-200 dark:border-[#2a2d3d] text-indigo-700 dark:text-[#6b5ce7] hover:bg-indigo-600 hover:text-white font-bold py-2 rounded-xl text-sm shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    AI Eval
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-5 mb-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-600 dark:text-gray-400">
                    Petition Number
                  </label>
                  <input
                    type="text"
                    value={petitionNumber}
                    onChange={(e) => setPetitionNumber(e.target.value)}
                    className="bg-slate-50 dark:bg-[#11131e] border border-slate-200 dark:border-[#2a2d3d] rounded-xl px-4 py-2.5 text-slate-900 dark:text-gray-200 outline-none"
                    placeholder="e.g. PET-1785..."
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-600 dark:text-gray-400">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="bg-slate-50 dark:bg-[#11131e] border border-slate-200 dark:border-[#2a2d3d] rounded-xl px-4 py-2.5 text-slate-900 dark:text-gray-200 outline-none"
                    placeholder="Unassigned"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-600 dark:text-gray-400">
                    Error Types
                  </label>
                  <input
                    type="text"
                    value={errorTypes.join(", ")}
                    onChange={(e) =>
                      setErrorTypes(
                        e.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      )
                    }
                    className="bg-slate-50 dark:bg-[#11131e] border border-slate-200 dark:border-[#2a2d3d] rounded-xl px-4 py-2.5 text-slate-900 dark:text-gray-200 outline-none"
                    placeholder="e.g. In Queue..."
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-600 dark:text-gray-400">
                    Observation Description
                  </label>
                  <textarea
                    rows="10"
                    value={observationDescription}
                    onChange={(e) => setObservationDescription(e.target.value)}
                    className="bg-slate-50 dark:bg-[#11131e] border border-slate-200 dark:border-[#2a2d3d] rounded-xl px-4 py-3 text-slate-900 dark:text-gray-200 outline-none resize-y"
                    placeholder="Details about the AI evaluation..."
                  ></textarea>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-200 dark:border-[#2a2d3d] pt-5">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold text-slate-600 dark:text-gray-400">
                    Final QA Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={qaScore}
                    onChange={(e) => setQaScore(Number(e.target.value))}
                    className="bg-slate-50 dark:bg-[#11131e] border border-slate-200 dark:border-[#2a2d3d] rounded-xl w-24 px-4 py-2 text-center text-slate-900 dark:text-gray-200 font-bold"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFormSubmit}
                  className="w-full bg-indigo-600 dark:bg-[#6b5ce7] hover:bg-indigo-700 text-white py-3 rounded-xl text-sm font-bold shadow-md mt-2"
                >
                  Log Observation
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: PETITION TABLE WITH BULK TOOLBAR */}
          <div className="w-full flex-1 min-w-0 flex flex-col gap-4">
            {/* BULK ACTION TOOLBAR */}
            <div className="flex items-center justify-between bg-white dark:bg-[#1e2030] p-4 rounded-xl border border-slate-200 dark:border-[#2a2d3d] shadow-sm transition-colors">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Selected:{" "}
                <span className="font-bold text-indigo-600 dark:text-[#6b5ce7]">
                  {selectedPetitionIds.length}
                </span>{" "}
                petitions
              </div>

              <BulkEvaluateButton
                selectedPetitions={selectedPetitionsData}
                onRefetch={() => {
                  refetch();
                  setSelectedPetitionIds([]);
                }}
              />
            </div>

            <div className={THEME.tableCard}>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#2a2d3d] uppercase tracking-wider bg-slate-50 dark:bg-[#161824]">
                      {/* Master Checkbox */}
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          onChange={handleToggleSelectAll}
                          checked={
                            filteredPetitions.length > 0 &&
                            selectedPetitionIds.length ===
                              filteredPetitions.length
                          }
                          className="accent-indigo-600 dark:accent-[#6b5ce7] cursor-pointer"
                        />
                      </th>
                      <th className="p-4">Petition ID</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetchingList && petitions.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-8 text-center text-slate-500"
                        >
                          Loading active petitions...
                        </td>
                      </tr>
                    ) : filteredPetitions.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-8 text-center text-slate-500"
                        >
                          No petitions match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPetitions.map((petition, index) => {
                        const serialNo = filteredPetitions.length - index;
                        const petitionKey = petition.petitionId || petition.id;
                        const isSelected =
                          selectedPetitionIds.includes(petitionKey);

                        return (
                          <tr
                            key={petitionKey}
                            className={`border-b border-slate-200 dark:border-[#2a2d3d] transition-colors ${
                              isSelected
                                ? "bg-indigo-50/50 dark:bg-[#25283d]"
                                : "hover:bg-slate-50 dark:hover:bg-[#1a1c28]"
                            }`}
                          >
                            {/* Row Checkbox */}
                            <td className="p-4 w-12">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(petitionKey)}
                                className="accent-indigo-600 dark:accent-[#6b5ce7] cursor-pointer"
                              />
                            </td>

                            <td className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="bg-slate-100 dark:bg-[#1e2030] text-slate-600 dark:text-[#8b92a5] border border-slate-200 dark:border-[#2a2d3d] px-2 py-1 rounded text-xs font-bold">
                                  #{serialNo}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 dark:text-gray-200">
                                      {petitionKey}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-gray-500">
                                    Created: {formatTime(petition.createdAt)}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 dark:text-gray-200">
                                  {petition.customerName ||
                                    petition.customer?.name ||
                                    "Unknown"}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                                  {petition.customerEmail ||
                                    petition.customer?.email ||
                                    "No email provided"}
                                </span>
                              </div>
                            </td>

                            <td className="p-4">
                              <span className="bg-amber-50 dark:bg-[#2d2a19] text-amber-700 dark:text-[#e5b300] border border-amber-200 dark:border-[#4d3c00] px-3 py-1 rounded text-xs font-bold uppercase tracking-wider">
                                {petition.status || "Pending"}
                              </span>
                            </td>

                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                {/* Copy Transcript Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQuickCopyTranscript(petitionKey)
                                  }
                                  className="text-slate-400 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-[#6b5ce7] transition-colors p-1"
                                  title="Copy Chat Transcript"
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <rect
                                      x="9"
                                      y="9"
                                      width="13"
                                      height="13"
                                      rx="2"
                                      ry="2"
                                    ></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                </button>

                                {/* View Transcript Modal Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectPetition(petition);
                                    handleViewClick(petitionKey);
                                  }}
                                  className="text-slate-400 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-[#6b5ce7] transition-colors p-1"
                                  title="View Transcript Modal"
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                  </svg>
                                </button>

                                {/* AI Evaluation Action Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectPetition(petition);
                                    handleRunAiEvaluation(petition);
                                  }}
                                  className="bg-indigo-50 dark:bg-[#1e2030] border border-indigo-200 dark:border-[#2a2d3d] text-indigo-700 dark:text-[#6b5ce7] hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-full text-xs font-bold transition-all ml-1"
                                >
                                  AI EVALUATION
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Modal for Transcript - Chat Bubble UI */}
        {isTranscriptModalOpen && (
          <div className={THEME.modalOverlay}>
            <div className={THEME.modalCard}>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-white dark:bg-[#111827]">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100">
                    Conversation Transcript
                  </h3>
                  <p className="text-sm text-slate-500">
                    Petition {selectedPetitionId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsTranscriptModalOpen(false);
                      handleRunAiEvaluation(selectedPetitionId);
                    }}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 px-3.5 py-2 text-sm font-bold transition-colors shadow-sm"
                    title="Run AI Evaluation on this conversation"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
                    </svg>
                    AI Evaluation
                  </button>
                  <button
                    onClick={() => handleCopyTranscript(selectedTranscript)}
                    className={THEME.modalButton}
                  >
                    Copy All
                  </button>
                  <button
                    onClick={() => setIsTranscriptModalOpen(false)}
                    className={THEME.modalButton}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="flex-1 max-h-[70vh] overflow-y-auto p-6 bg-slate-950 flex flex-col gap-4">
                {isTranscriptLoading ? (
                  <p className="text-slate-400 text-center py-8">
                    Loading transcript...
                  </p>
                ) : Array.isArray(selectedTranscript) &&
                  selectedTranscript.length > 0 ? (
                  selectedTranscript.map((msg, index) => {
                    const role = (msg.role || "").toLowerCase();
                    const isSystem = role === "system";
                    const isCustomer = role === "customer";

                    if (isSystem) {
                      return (
                        <div key={index} className="flex justify-center my-2">
                          <span className="bg-slate-800/80 text-slate-300 text-xs px-4 py-1.5 rounded-full border border-slate-700 font-medium tracking-wide shadow-sm">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={index}
                        className={`flex flex-col max-w-[80%] rounded-2xl p-4 shadow-sm ${
                          isCustomer
                            ? "self-end bg-indigo-600 text-white rounded-br-sm"
                            : "self-start bg-[#161b22] text-slate-100 border border-slate-800 rounded-bl-sm"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-6 mb-1.5 opacity-90 text-[11px] font-bold uppercase tracking-wider">
                          <span>{msg.name || "Unknown"}</span>
                          <span className="font-normal opacity-75">
                            {msg.time || ""}
                          </span>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-400 text-center py-8">
                    No messages found in this transcript.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// BULK EVALUATION BUTTON COMPONENT (ROBUST)
// ==========================================
const BulkEvaluateButton = ({ selectedPetitions, onRefetch }) => {
  const [bulkEvaluateAndLog, { isLoading }] = useBulkEvaluateAndLogMutation();

  const handleRunBulk = async () => {
    if (!selectedPetitions || selectedPetitions.length === 0) {
      alert("Please select petitions from the queue first.");
      return;
    }

    try {
      const result = await bulkEvaluateAndLog(selectedPetitions).unwrap();
      console.log("Raw Backend Bulk Response:", result);

      if (result?.success) {
        const summary =
          result.summary ||
          result.evaluationSummary ||
          result.data?.summary ||
          {};
        const loggingSummary =
          result.loggingSummary ||
          result.logging ||
          result.data?.loggingSummary ||
          {};

        const successful =
          summary.successful ??
          summary.successCount ??
          selectedPetitions.length;
        const failed = summary.failed ?? summary.failCount ?? 0;
        const logged =
          loggingSummary.successfulLogs ??
          loggingSummary.loggedCount ??
          successful;

        alert(
          `Bulk Complete!\n- Evaluated: ${successful}\n- Failed: ${failed}\n- Logged Externally: ${logged}`,
        );

        if (onRefetch) onRefetch();
      } else {
        alert(
          `Bulk action failed: ${result?.message || "Server returned failure."}`,
        );
      }
    } catch (error) {
      console.error("Bulk action error:", error);
      alert(
        `Bulk action failed: ${error?.message || error?.data?.message || "Server error"}`,
      );
    }
  };

  return (
    <button
      onClick={handleRunBulk}
      disabled={
        isLoading || !selectedPetitions || selectedPetitions.length === 0
      }
      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 transition shadow-sm"
    >
      {isLoading
        ? "Processing Chunks..."
        : `Bulk Evaluate Selected (${selectedPetitions?.length || 0})`}
    </button>
  );
};

export default App;
