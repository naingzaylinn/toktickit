import { useState } from "react";
import { checkSystem, Category } from "../api.js";
export default function SystemDiagnostic() {
    const [checkState, setCheckState] = useState("idle");
    const [errorMessage, setErrorMessage] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    async function handleCheck() { setCheckState("loading"); try {
        const result = await checkSystem();
        setCategories(result.categories);
        setCheckState("success");
    }
    catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Unable to check system.");
        setCheckState("error");
    } }
    return <>      {/* Lab 1 Regression / Diagnostic System Status Section */}
      <div className="container py-3" style={{ maxWidth: 640 }}>
        <hr className="my-4 text-muted"/>
        <div className="d-flex align-items-center justify-content-between">
          <span className="small text-muted">System Diagnostic:</span>
          <button className="btn btn-sm btn-outline-success" onClick={handleCheck} disabled={checkState === "loading"}>
            {checkState === "loading" ? "Loading…" : "Check System"}
          </button>
        </div>

        {checkState === "success" && (<div className="alert alert-success mt-3" role="alert">
            <strong>Online</strong>
            {categories.length > 0 && (<ul className="mt-2 mb-0">
                {categories.map((category) => (<li key={category.id}>{category.name}</li>))}
              </ul>)}
          </div>)}

        {checkState === "error" && (<div className="alert alert-danger mt-3" role="alert">
            <strong>Offline</strong>
            {errorMessage && <div className="small mt-1">{errorMessage}</div>}
          </div>)}
      </div>
    </>;
}
