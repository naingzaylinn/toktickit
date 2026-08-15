import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);

  async function handleCheck() {
    setState("loading");
    setErrorMessage("");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch (err: unknown) {
      setState("error");
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred");
      }
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "success" && (
        <div className="alert alert-success mt-4" role="alert">
          <strong>Online</strong>
          {categories.length > 0 && (
            <ul className="mt-2 mb-0">
              {categories.map((category) => (
                <li key={category.id}>{category.name}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-4" role="alert">
          <strong>Offline</strong>
          {errorMessage && <div className="small mt-1">{errorMessage}</div>}
        </div>
      )}
    </div>
  );
}
