import { installZoteroFailureDiagnostics } from "../zotero/diagnosticBridge";
import { installZoteroLeakProbeDigest } from "../zotero/leakProbeDigest";
import { installZoteroTestObjectCleanupHarness } from "../zotero/objectCleanupHarness";
import { installZoteroPerformanceProbeDigest } from "../zotero/performanceProbeDigest";
import { installZoteroRoutinePruning } from "../zotero/routinePrune";

installZoteroFailureDiagnostics();
installZoteroRoutinePruning();
installZoteroTestObjectCleanupHarness();
installZoteroLeakProbeDigest();
installZoteroPerformanceProbeDigest();
