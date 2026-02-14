import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import { useToast } from "@/contexts/ToastContext";
import { messages } from "@/i18n/messages";
import {
  clearSetupStep,
  getDatabaseBootstrap,
  getDockerPostgresBackupUrl,
  getDockerPostgresStatus,
  getSetupStatus,
  getSetupSteps,
  initializeSetup,
  provisionDatabase,
  recreateDockerPostgres,
  saveSetupStep,
  setDatabaseBootstrap,
  startDockerPostgres,
  testDatabaseConnection,
  type DatabaseBootstrapStatus,
  type DockerPostgresStatusResponse,
  type SetupStepState,
} from "@/lib/setupApi";
import { useEffect, useMemo, useState } from "react";

type StepId = "database" | "admin" | "auth" | "summary";

const steps: { id: StepId; titleKey: keyof typeof messages.en; captionKey: keyof typeof messages.en }[] = [
  { id: "database", titleKey: "database", captionKey: "stepDatabaseCaption" },
  { id: "admin", titleKey: "admin", captionKey: "stepAdminCaption" },
  { id: "auth", titleKey: "auth", captionKey: "stepAuthCaption" },
  { id: "summary", titleKey: "summary", captionKey: "stepSummaryCaption" },
];

export default function SetupWizardPage() {
  const { t } = useI18n();
  const [stepIndex, setStepIndex] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorStep, setErrorStep] = useState<StepId | null>(null);
  const [statusMessage, setStatusMessage] = useState(() => t("sessionActive"));
  const [stepStates, setStepStates] = useState<Record<string, SetupStepState>>({});
  const [stepsLoaded, setStepsLoaded] = useState(false);
  const [stepSaving, setStepSaving] = useState<StepId | null>(null);
  const [stepClearing, setStepClearing] = useState<StepId | null>(null);
  const [initialStepResolved, setInitialStepResolved] = useState(false);
  const [adminEmail, setAdminEmail] = useState(() => t("defaultAdminEmail"));
  const [adminName, setAdminName] = useState(() => t("defaultAdminName"));
  const [adminPassword, setAdminPassword] = useState(() => t("defaultAdminPassword"));
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminPasswordSaved, setAdminPasswordSaved] = useState(false);
  const [authLocal, setAuthLocal] = useState(true);
  const [authAd, setAuthAd] = useState(false);
  const [authAzure, setAuthAzure] = useState(true);
  const [windowsAdDomain, setWindowsAdDomain] = useState("");
  const [windowsAdLdapUrl, setWindowsAdLdapUrl] = useState("");
  const [windowsAdBaseDn, setWindowsAdBaseDn] = useState("");
  const [windowsAdBindDn, setWindowsAdBindDn] = useState("");
  const [windowsAdBindPassword, setWindowsAdBindPassword] = useState("");
  const [windowsAdUserFilter, setWindowsAdUserFilter] = useState("");
  const [windowsAdGroupFilter, setWindowsAdGroupFilter] = useState("");
  const [windowsAdUseSsl, setWindowsAdUseSsl] = useState(true);
  const [windowsAdStartTls, setWindowsAdStartTls] = useState(false);
  const [windowsAdTimeoutSeconds, setWindowsAdTimeoutSeconds] = useState("15");
  const [showWindowsAdvanced, setShowWindowsAdvanced] = useState(false);
  const [showBindPassword, setShowBindPassword] = useState(false);
  const [azureTenantId, setAzureTenantId] = useState("");
  const [azureClientId, setAzureClientId] = useState("");
  const [azureClientSecret, setAzureClientSecret] = useState("");
  const [azureAuthUrl, setAzureAuthUrl] = useState("");
  const [azureTokenUrl, setAzureTokenUrl] = useState("");
  const [azureAuthority, setAzureAuthority] = useState("");
  const [azureRedirectUri, setAzureRedirectUri] = useState("");
  const [azureScopes, setAzureScopes] = useState("openid profile email");
  const [azureIssuer, setAzureIssuer] = useState("");
  const [azureUsePkce, setAzureUsePkce] = useState(true);
  const [showAzureAdvanced, setShowAzureAdvanced] = useState(false);
  const [showAzureSecret, setShowAzureSecret] = useState(false);
  const [authBindPasswordSaved, setAuthBindPasswordSaved] = useState(false);
  const [authAzureSecretSaved, setAuthAzureSecretSaved] = useState(false);
  const [dbProviderChoice, setDbProviderChoice] = useState<
    "postgres-docker" | "postgres" | "sqlserver" | "mysql"
  >("postgres-docker");
  const [dbHost, setDbHost] = useState("localhost");
  const [dbPort, setDbPort] = useState("5432");
  const [dbName, setDbName] = useState("puod");
  const [dbUser, setDbUser] = useState("puod_user");
  const [dbPassword, setDbPassword] = useState("");
  const [dbShowPassword, setDbShowPassword] = useState(false);
  const [dbConnection, setDbConnection] = useState("");
  const [dbUseCustom, setDbUseCustom] = useState(false);
  const [showDbAdvanced, setShowDbAdvanced] = useState(false);
  const [dbSslMode, setDbSslMode] = useState("prefer");
  const [dbTrustServerCertificate, setDbTrustServerCertificate] = useState(false);
  const [dbSslRootCert, setDbSslRootCert] = useState("");
  const [dbSslCert, setDbSslCert] = useState("");
  const [dbSslKey, setDbSslKey] = useState("");
  const [dbTlsMinVersion, setDbTlsMinVersion] = useState("");
  const [showDbExamples, setShowDbExamples] = useState(false);
  const [testStatus, setTestStatus] = useState<null | { success: boolean; message: string; elapsed: number }>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showFullTestError, setShowFullTestError] = useState(false);
  const [isStartingDocker, setIsStartingDocker] = useState(false);
  const [dockerStatus, setDockerStatus] = useState<null | { success: boolean; message: string }>(null);
  const [dockerPhase, setDockerPhase] = useState<null | "container" | "database" | "tables">(null);
  const [dockerPhaseMessage, setDockerPhaseMessage] = useState<string | null>(null);
  const [dockerExisting, setDockerExisting] = useState<null | DockerPostgresStatusResponse>(null);
  const [showDockerPrompt, setShowDockerPrompt] = useState(false);
  const [showDockerBackupFallback, setShowDockerBackupFallback] = useState(false);
  const [dockerBackupInProgress, setDockerBackupInProgress] = useState(false);
  const [dockerBackupPath, setDockerBackupPath] = useState<string | null>(null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionStatus, setProvisionStatus] = useState<null | { success: boolean; message: string }>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseBootstrapStatus | null>(null);
  const [dbRequiresRestart, setDbRequiresRestart] = useState(false);
  const { showToast } = useToast();
  const activeStep = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const canBack = stepIndex > 0;
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const databaseConfigured = Boolean(dbStatus?.connectionStringMasked);
  const databaseProvisioned = Boolean(dbStatus?.provisionedAt);
  const adminStep = stepStates.admin;
  const authStep = stepStates.auth;
  const adminStepCompleted = Boolean(adminStep?.isCompleted);
  const authStepCompleted = Boolean(authStep?.isCompleted);
  const adminStepSavedAt = adminStep?.savedAt ?? null;
  const authStepSavedAt = authStep?.savedAt ?? null;
  const dbFieldError = (value: string) =>
    activeStep.id === "database" && Boolean(error) && !value.trim();
  const fieldError = (step: StepId, value: string) =>
    activeStep.id === step && Boolean(error) && !value.trim();
  const validationErrors = useMemo(
    () =>
      new Set([
        t("fillConnectionFields"),
        t("fillUserPassword"),
        t("sslRootRequired"),
        t("sslClientRequired"),
        t("databaseTestRequired"),
        t("setupDatabaseFirst"),
        t("restartUserService"),
        t("provisionRequired"),
        t("windowsAdRequired"),
        t("azureAdRequired"),
        t("adminRequired"),
        t("adminPasswordRequired"),
        t("saveStepsBeforeFinish"),
      ]),
    [t]
  );
  const isValidationError = Boolean(error) && validationErrors.has(error);
  const shouldShowError = Boolean(error) && (!errorStep || errorStep === activeStep.id);

  const authSummary = useMemo(() => {
    const items = [];
    if (authLocal) items.push(t("localAuth"));
    if (authAd) items.push(t("windowsAd"));
    if (authAzure) items.push(t("azureAd"));
    return items.join(" | ");
  }, [authLocal, authAd, authAzure, t]);

  const effectiveProvider = dbProviderChoice.startsWith("postgres") ? "postgres" : dbProviderChoice;
  const isDockerProvider = dbProviderChoice === "postgres-docker";
  const dockerComplete = Boolean(provisionStatus?.success || dbStatus?.provisionedAt);
  const dockerHasContainer = Boolean(dockerExisting?.exists);
  const dockerConfigured = Boolean(dockerExisting?.configured);
  const dockerDetectedUser = dockerExisting?.username?.trim();
  const dockerBackupFileName = useMemo(() => {
    if (!dockerBackupPath) return null;
    const normalized = dockerBackupPath.replace(/\\/g, "/");
    return normalized.split("/").pop() ?? null;
  }, [dockerBackupPath]);
  const canContinueDatabase = databaseProvisioned && !dbRequiresRestart;
  const canContinueAdmin = adminStepCompleted;
  const canContinueAuth = authStepCompleted;
  const canContinueStep =
    activeStep.id === "database"
      ? canContinueDatabase
      : activeStep.id === "admin"
        ? canContinueAdmin
        : activeStep.id === "auth"
          ? canContinueAuth
          : true;

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (typeof err === "object" && err && "response" in err) {
      const response = (err as { response?: { data?: unknown } }).response;
      if (response?.data && typeof response.data === "object" && "message" in response.data) {
        const message = (response.data as { message?: string }).message;
        if (message) return message;
      }
      if (typeof response?.data === "string") {
        return response.data;
      }
    }
    return err instanceof Error ? err.message : fallback;
  };

  const setStepError = (stepId: StepId, message: string) => {
    setError(message);
    setErrorStep(stepId);
  };

  const parseBool = (value: string | null | undefined, fallback: boolean) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  };

  const applySetupSteps = (stepsResponse: SetupStepState[]) => {
    const map: Record<string, SetupStepState> = {};
    stepsResponse.forEach((step) => {
      map[step.stepId] = step;
    });
    setStepStates(map);
    setStepsLoaded(true);

    const adminData = map.admin?.data;
    if (adminData) {
      if ("adminEmail" in adminData && adminData.adminEmail) {
        setAdminEmail(adminData.adminEmail);
      }
      if ("adminName" in adminData && adminData.adminName) {
        setAdminName(adminData.adminName);
      }
      if ("adminPassword" in adminData && adminData.adminPassword) {
        setAdminPassword("");
        setAdminPasswordSaved(true);
      }
      if (!adminData.adminPassword) {
        setAdminPasswordSaved(false);
      }
    } else {
      setAdminPasswordSaved(false);
    }

    const authData = map.auth?.data;
    if (authData) {
      if ("authLocal" in authData) {
        setAuthLocal(parseBool(authData.authLocal, authLocal));
      }
      if ("authAd" in authData) {
        setAuthAd(parseBool(authData.authAd, authAd));
      }
      if ("authAzure" in authData) {
        setAuthAzure(parseBool(authData.authAzure, authAzure));
      }
      if ("windowsAdDomain" in authData && authData.windowsAdDomain !== null) {
        setWindowsAdDomain(authData.windowsAdDomain ?? "");
      }
      if ("windowsAdLdapUrl" in authData && authData.windowsAdLdapUrl !== null) {
        setWindowsAdLdapUrl(authData.windowsAdLdapUrl ?? "");
      }
      if ("windowsAdBaseDn" in authData && authData.windowsAdBaseDn !== null) {
        setWindowsAdBaseDn(authData.windowsAdBaseDn ?? "");
      }
      if ("windowsAdBindDn" in authData && authData.windowsAdBindDn !== null) {
        setWindowsAdBindDn(authData.windowsAdBindDn ?? "");
      }
      if ("windowsAdBindPassword" in authData && authData.windowsAdBindPassword) {
        setWindowsAdBindPassword("");
        setAuthBindPasswordSaved(true);
      }
      if (!authData.windowsAdBindPassword) {
        setAuthBindPasswordSaved(false);
      }
      if ("windowsAdUserFilter" in authData && authData.windowsAdUserFilter !== null) {
        setWindowsAdUserFilter(authData.windowsAdUserFilter ?? "");
      }
      if ("windowsAdGroupFilter" in authData && authData.windowsAdGroupFilter !== null) {
        setWindowsAdGroupFilter(authData.windowsAdGroupFilter ?? "");
      }
      if ("windowsAdUseSsl" in authData) {
        setWindowsAdUseSsl(parseBool(authData.windowsAdUseSsl, windowsAdUseSsl));
      }
      if ("windowsAdStartTls" in authData) {
        setWindowsAdStartTls(parseBool(authData.windowsAdStartTls, windowsAdStartTls));
      }
      if ("windowsAdTimeoutSeconds" in authData && authData.windowsAdTimeoutSeconds !== null) {
        setWindowsAdTimeoutSeconds(authData.windowsAdTimeoutSeconds ?? "");
      }
      if ("azureTenantId" in authData && authData.azureTenantId !== null) {
        setAzureTenantId(authData.azureTenantId ?? "");
      }
      if ("azureClientId" in authData && authData.azureClientId !== null) {
        setAzureClientId(authData.azureClientId ?? "");
      }
      if ("azureClientSecret" in authData && authData.azureClientSecret) {
        setAzureClientSecret("");
        setAuthAzureSecretSaved(true);
      }
      if (!authData.azureClientSecret) {
        setAuthAzureSecretSaved(false);
      }
      if ("azureAuthUrl" in authData && authData.azureAuthUrl !== null) {
        setAzureAuthUrl(authData.azureAuthUrl ?? "");
      }
      if ("azureTokenUrl" in authData && authData.azureTokenUrl !== null) {
        setAzureTokenUrl(authData.azureTokenUrl ?? "");
      }
      if ("azureAuthority" in authData && authData.azureAuthority !== null) {
        setAzureAuthority(authData.azureAuthority ?? "");
      }
      if ("azureRedirectUri" in authData && authData.azureRedirectUri !== null) {
        setAzureRedirectUri(authData.azureRedirectUri ?? "");
      }
      if ("azureScopes" in authData && authData.azureScopes !== null) {
        setAzureScopes(authData.azureScopes ?? "");
      }
      if ("azureIssuer" in authData && authData.azureIssuer !== null) {
        setAzureIssuer(authData.azureIssuer ?? "");
      }
      if ("azureUsePkce" in authData) {
        setAzureUsePkce(parseBool(authData.azureUsePkce, azureUsePkce));
      }
    } else {
      setAuthBindPasswordSaved(false);
      setAuthAzureSecretSaved(false);
    }
  };

  const refreshSetupSteps = async () => {
    try {
      const response = await getSetupSteps();
      applySetupSteps(response.steps);
    } catch {
      setStepsLoaded(true);
    }
  };

  const dockerStepState = (step: "container" | "database" | "tables") => {
    if (dockerComplete) {
      return "done";
    }
    if (!dockerPhase) {
      return "pending";
    }
    if (step === "container") {
      return dockerPhase === "container" ? "running" : "done";
    }
    if (step === "database") {
      if (dockerPhase === "database") return "running";
      if (dockerPhase === "tables") return "done";
      return "pending";
    }
    return dockerPhase === "tables" ? "running" : "pending";
  };

  const dockerBackupStepState = () => {
    if (dockerBackupInProgress) return "running";
    if (dockerBackupFileName) return "done";
    return "pending";
  };

  const generateSecurePassword = () => {
    const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    const bytes = new Uint32Array(24);
    crypto.getRandomValues(bytes);
    const next = Array.from(bytes, (value) => charset[value % charset.length]).join("");
    setDbPassword(next);
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForPostgresReady = async (connectionString: string) => {
    setDockerPhaseMessage(t("dockerWaitingReady"));
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await sleep(5000);
      const testResponse = await testDatabaseConnection({
        provider: "postgres",
        connectionString,
      });
      setTestStatus({
        success: testResponse.success,
        message: testResponse.message,
        elapsed: testResponse.elapsedMilliseconds,
      });
      if (testResponse.success) {
        setDockerPhaseMessage(null);
        return true;
      }
      setDockerPhaseMessage(testResponse.message);
    }
    return false;
  };

  const buildConnectionString = () => {
    const host = dbHost.trim();
    const port = dbPort.trim();
    const database = dbName.trim();
    const user = dbUser.trim();
    const password = dbPassword;

    if (!host || !database || !user || !password) {
      return "";
    }

    if (effectiveProvider === "sqlserver") {
      const server = port ? `${host},${port}` : host;
      const parts = [
        `Server=${server}`,
        `Database=${database}`,
        `User Id=${user}`,
        `Password=${password}`,
      ];
      if (dbTrustServerCertificate) {
        parts.push("TrustServerCertificate=True");
      }
      if (dbTlsMinVersion) {
        parts.push("Encrypt=True", `MinTLSVersion=${dbTlsMinVersion}`);
      }
      if (dbTlsMinVersion && !dbTrustServerCertificate) {
        parts.push("Encrypt=True");
      }
      return parts.join(";");
    }

    if (effectiveProvider === "mysql") {
      const mysqlPort = port || "3306";
      const parts = [
        `Server=${host}`,
        `Port=${mysqlPort}`,
        `Database=${database}`,
        `User=${user}`,
        `Password=${password}`,
      ];
      if (dbSslMode) {
        parts.push(`SslMode=${dbSslMode}`);
      }
      if (dbTlsMinVersion) {
        parts.push(`TlsVersion=${dbTlsMinVersion}`);
      }
      if (dbSslRootCert) {
        parts.push(`SslCa=${dbSslRootCert}`);
      }
      if (dbSslCert) {
        parts.push(`SslCert=${dbSslCert}`);
      }
      if (dbSslKey) {
        parts.push(`SslKey=${dbSslKey}`);
      }
      return parts.join(";");
    }

    const pgPort = port || "5432";
    const parts = [
      `Host=${host}`,
      `Port=${pgPort}`,
      `Database=${database}`,
      `Username=${user}`,
      `Password=${password}`,
    ];
    if (dbSslMode) {
      parts.push(`SSL Mode=${dbSslMode}`);
    }
    if (dbSslRootCert) {
      parts.push(`Root Certificate=${dbSslRootCert}`);
    }
    if (dbSslCert) {
      parts.push(`SSL Certificate=${dbSslCert}`);
    }
    if (dbSslKey) {
      parts.push(`SSL Key=${dbSslKey}`);
    }
    return parts.join(";");
  };

  const connectionStringValue = dbUseCustom ? dbConnection : buildConnectionString();

  const securitySummary = () => {
    if (effectiveProvider === "sqlserver") {
      const items = [];
      if (dbTrustServerCertificate) items.push(t("trustServerCertificate"));
      if (dbTlsMinVersion) items.push(`TLS ${dbTlsMinVersion}`);
      return items.length ? items.join(" | ") : t("securitySummaryNone");
    }

    const items = [];
    if (dbSslMode) items.push(`SSL ${dbSslMode}`);
    if (dbTlsMinVersion) items.push(`TLS ${dbTlsMinVersion}`);
    if (dbSslRootCert) items.push(t("securityRootCa"));
    if (dbSslCert) items.push(t("securityClientCert"));
    if (dbSslKey) items.push(t("securityClientKey"));
    return items.length ? items.join(" | ") : t("securitySummaryNone");
  };

  const applySecurityPreset = (preset: "docker" | "strict") => {
    if (preset === "docker") {
      setShowDbAdvanced(true);
      if (effectiveProvider === "sqlserver") {
        setDbTrustServerCertificate(true);
        setDbTlsMinVersion("1.2");
      } else if (effectiveProvider === "mysql") {
        setDbSslMode("Preferred");
        setDbTlsMinVersion("1.2");
      } else {
        setDbSslMode("prefer");
        setDbTlsMinVersion("");
      }
      setDbSslRootCert("");
      setDbSslCert("");
      setDbSslKey("");
      return;
    }

    if (effectiveProvider === "sqlserver") {
      setShowDbAdvanced(true);
      setDbTrustServerCertificate(false);
      setDbTlsMinVersion("1.2");
      setDbSslRootCert("");
      setDbSslCert("");
      setDbSslKey("");
    } else if (effectiveProvider === "mysql") {
      setShowDbAdvanced(true);
      setDbSslMode("VerifyFull");
      setDbTlsMinVersion("1.2");
      setDbSslRootCert("");
      setDbSslCert("");
      setDbSslKey("");
    } else {
      setShowDbAdvanced(true);
      setDbSslMode("verify-full");
      setDbTlsMinVersion("");
    }
  };

  const requiresRootCa = () => {
    if (effectiveProvider === "sqlserver") {
      return false;
    }
    return dbSslMode.toLowerCase().includes("verify");
  };

  const requiresClientCert = () => {
    if (effectiveProvider === "sqlserver") {
      return false;
    }
    return dbSslMode.toLowerCase().includes("verify-full");
  };

  const providerBadge = () => {
    switch (dbProviderChoice) {
      case "postgres-docker":
        return t("badgeDocker");
      case "postgres":
        return t("badgeExternal");
      case "sqlserver":
        return t("badgeSqlServer");
      case "mysql":
        return t("badgeMySql");
      default:
        return t("provider" as any);
    }
  };

  useEffect(() => {
    if (dbProviderChoice === "postgres-docker") {
      setDbHost("localhost");
      setDbPort("5432");
      setDbName("puod");
      if (!dockerDetectedUser) {
        setDbUser("puod_user");
      }
      setDbPassword("puodPasswd@25");
      setDbUseCustom(false);
      if (dbSslMode !== "prefer") {
        setDbSslMode("prefer");
      }
      return;
    }

    if (dbProviderChoice === "postgres" && (dbPort === "3306" || dbPort === "1433" || dbPort === "")) {
      setDbPort("5432");
      if (!["prefer", "require", "verify-ca", "verify-full", "disable"].includes(dbSslMode)) {
        setDbSslMode("prefer");
      }
      return;
    }

    if (dbProviderChoice === "mysql" && (dbPort === "5432" || dbPort === "1433" || dbPort === "")) {
      setDbPort("3306");
      if (!["Preferred", "Required", "VerifyCA", "VerifyFull", "Disabled"].includes(dbSslMode)) {
        setDbSslMode("Preferred");
      }
      return;
    }

    if (dbProviderChoice === "sqlserver" && (dbPort === "5432" || dbPort === "3306" || dbPort === "")) {
      setDbPort("1433");
    }
  }, [dbProviderChoice]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      window.location.href = "/login";
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getDatabaseBootstrap()
      .then((status) => {
        if (!mounted) return;
        setDbStatus(status);
        if (status.provider) {
          if (status.provider === "postgres") {
            setDbProviderChoice("postgres");
          } else if (status.provider === "sqlserver") {
            setDbProviderChoice("sqlserver");
          } else if (status.provider === "mysql") {
            setDbProviderChoice("mysql");
          }
        }
      })
      .catch(() => {
        if (!mounted) return;
        setStatusMessage(t("unableReadDatabase"));
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getSetupStatus()
      .then((status) => {
        if (!mounted) return;
        if (status.adminEmail) {
          setAdminEmail(status.adminEmail);
          setAdminName(status.adminEmail);
        }
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getSetupSteps()
      .then((response) => {
        if (!mounted) return;
        applySetupSteps(response.steps);
      })
      .catch(() => {
        if (!mounted) return;
        setStepsLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [databaseConfigured, databaseProvisioned]);

  useEffect(() => {
    if (!stepsLoaded || initialStepResolved) {
      return;
    }
    if (!databaseProvisioned) {
      setStepIndex(0);
      setInitialStepResolved(true);
      return;
    }
    if (!adminStepCompleted) {
      setStepIndex(steps.findIndex((step) => step.id === "admin"));
      setInitialStepResolved(true);
      return;
    }
    if (!authStepCompleted) {
      setStepIndex(steps.findIndex((step) => step.id === "auth"));
      setInitialStepResolved(true);
      return;
    }
    setStepIndex(steps.findIndex((step) => step.id === "summary"));
    setInitialStepResolved(true);
  }, [stepsLoaded, initialStepResolved, databaseProvisioned, adminStepCompleted, authStepCompleted]);

  useEffect(() => {
    setError("");
    setErrorStep(null);
  }, [activeStep.id]);

  useEffect(() => {
    if (!isDockerProvider) {
      setShowDockerPrompt(false);
      return;
    }
    let mounted = true;
    getDockerPostgresStatus()
      .then((status) => {
        if (!mounted) return;
        setDockerExisting(status);
        if (status.username) {
          setDbUser(status.username);
        }
        setShowDockerPrompt(status.exists);
      })
      .catch((err) => {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : t("dockerStartFailed");
        setStepError("database", message);
      });
    return () => {
      mounted = false;
    };
  }, [isDockerProvider, t]);

  const saveDatabase = async () => {
    setIsBusy(true);
    setError("");
    setErrorStep(null);
    try {
      const connectionString = connectionStringValue;
      if (!connectionString) {
        setStepError("database", t("fillConnectionFields"));
        return;
      }

      if (showDbAdvanced && !dbUseCustom) {
        if (requiresRootCa() && !dbSslRootCert) {
          setStepError("database", t("sslRootRequired"));
          return;
        }
        if (requiresClientCert() && (!dbSslCert || !dbSslKey)) {
          setStepError("database", t("sslClientRequired"));
          return;
        }
      }

      if (!testStatus || !testStatus.success) {
        setStepError("database", t("databaseTestRequired"));
        return;
      }

      const response = await setDatabaseBootstrap({
        provider: effectiveProvider,
        connectionString,
      });
      setDbStatus(response);
      showToast(t("databaseUpdatedRestart"), { title: t("saveDatabase"), variant: "success" });
      setDbRequiresRestart(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("saveDatabaseFailed");
      setStepError("database", message);
    } finally {
      setIsBusy(false);
    }
  };

  const testDatabase = async () => {
    setIsTesting(true);
    setError("");
    setErrorStep(null);
    setTestStatus(null);
    try {
      const connectionString = connectionStringValue;
      if (!connectionString) {
        setStepError("database", t("fillConnectionFields"));
        return;
      }

      const response = await testDatabaseConnection({
        provider: effectiveProvider,
        connectionString,
      });
      setTestStatus({
        success: response.success,
        message: response.message,
        elapsed: response.elapsedMilliseconds,
      });
      setShowFullTestError(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("testConnectionFailed");
      setStepError("database", message);
      setTestStatus({
        success: false,
        message,
        elapsed: 0,
      });
      setShowFullTestError(false);
    } finally {
      setIsTesting(false);
    }
  };

  const startDockerDatabase = async () => {
    setIsStartingDocker(true);
    setDockerStatus(null);
    setDockerPhase("container");
    setDockerPhaseMessage(null);
    setError("");
    setErrorStep(null);
    setShowDockerBackupFallback(false);
    setDockerBackupInProgress(false);
    setDockerBackupPath(null);

    const host = "localhost";
    const port = "5432";
    const name = "puod";
    const user = dbUser.trim();
    const password = dbPassword;

    if (!user || !password) {
      setIsStartingDocker(false);
      setStepError("database", t("fillUserPassword"));
      return;
    }

    try {
      const status = await getDockerPostgresStatus();
      setDockerExisting(status);
      if (status.exists) {
        setShowDockerPrompt(true);
        setIsStartingDocker(false);
        setDockerPhase(null);
        return;
      }
    } catch (err) {
      const message = getErrorMessage(err, t("dockerStartFailed"));
      setStepError("database", message);
      setIsStartingDocker(false);
      setDockerPhase(null);
      return;
    }

    setDbProviderChoice("postgres-docker");
    setDbHost(host);
    setDbPort(port);
    setDbName(name);
    setDbUser(user || "puod_user");
    setDbUseCustom(false);

    const connectionString = `Host=${host};Port=${port};Database=${name};Username=${user};Password=${password};SSL Mode=prefer`;

    try {
      let response = await startDockerPostgres({
        connectionString,
        timeoutSeconds: 90,
      });
      if (!response.success && response.message.includes("not ready yet")) {
        setDockerStatus({ success: false, message: response.message });
        const ready = await waitForPostgresReady(connectionString);
        if (ready) {
          response = { ...response, success: true, message: t("dockerStartSuccess") };
        }
      }
      if (!response.success) {
        setDockerStatus({ success: false, message: t("dockerStartFailed") });
        setStepError("database", response.message);
        return;
      }
      setDockerPhase("database");
      setDockerStatus({ success: true, message: t("dockerStartSuccess") });
      await runDockerProvision(connectionString);
    } catch (err) {
      const message = getErrorMessage(err, t("dockerStartFailed"));
      setDockerStatus({ success: false, message: t("dockerStartFailed") });
      setStepError("database", message);
    } finally {
      setIsStartingDocker(false);
    }
  };

  const runDockerProvision = async (connectionString: string) => {
    const testResponse = await testDatabaseConnection({
      provider: "postgres",
      connectionString,
    });
    setTestStatus({
      success: testResponse.success,
      message: testResponse.message,
      elapsed: testResponse.elapsedMilliseconds,
    });
    if (!testResponse.success) {
      setDockerStatus({ success: false, message: testResponse.message });
      setDockerPhaseMessage(testResponse.message);
      setStepError("database", testResponse.message);
      setDockerPhase(null);
      return;
    }
    setDockerPhase("tables");
    try {
      const saved = await setDatabaseBootstrap({
        provider: "postgres",
        connectionString,
      });
      setDbStatus(saved);
      setDockerPhaseMessage(t("provisioning"));
      const provisioned = await provisionDatabase();
      setDbStatus(provisioned);
      setProvisionStatus({ success: true, message: t("provisionSuccess") });
      setDockerPhaseMessage(null);
      setDockerPhase(null);
    } catch (err) {
      const message = getErrorMessage(err, t("provisionFailed"));
      setDockerStatus({ success: false, message });
      setDockerPhaseMessage(message);
      setStepError("database", message);
      setDockerPhase(null);
    }
  };

  const handleDockerExisting = async (backup: boolean) => {
    setIsStartingDocker(true);
    setDockerStatus(null);
    setDockerPhase("container");
    setDockerPhaseMessage(null);
    setShowDockerPrompt(false);
    setShowDockerBackupFallback(false);
    setError("");
    setErrorStep(null);
    setDockerBackupInProgress(false);
    setDockerBackupPath(null);

    const host = "localhost";
    const port = "5432";
    const name = "puod";
    const user = dbUser.trim();
    const password = dbPassword;

    if (!user || !password) {
      setIsStartingDocker(false);
      setDockerPhase(null);
      setStepError("database", t("fillUserPassword"));
      return;
    }

    const connectionString = `Host=${host};Port=${port};Database=${name};Username=${user};Password=${password};SSL Mode=prefer`;

    try {
      if (backup) {
        setDockerBackupInProgress(true);
        const response = await recreateDockerPostgres({
          connectionString,
          backup: true,
        });
        if (!response.success) {
          setDockerStatus({ success: false, message: t("dockerBackupFailed") });
          setStepError("database", response.message);
          setShowDockerBackupFallback(true);
          setDockerBackupInProgress(false);
          setDockerPhase(null);
          return;
        }
        setDockerBackupPath(response.backupPath ?? null);
        setDockerBackupInProgress(false);
        setDockerStatus({ success: true, message: t("dockerBackupSuccess") });
        setDockerPhase("database");
        let start = await startDockerPostgres({ connectionString, timeoutSeconds: 90 });
        if (!start.success && start.message.includes("not ready yet")) {
          setDockerStatus({ success: false, message: start.message });
          const ready = await waitForPostgresReady(connectionString);
          if (ready) {
            start = { ...start, success: true, message: t("dockerStartSuccess") };
          }
        }
        if (!start.success) {
          setDockerStatus({ success: false, message: t("dockerStartFailed") });
          setStepError("database", start.message);
          setDockerPhase(null);
          return;
        }
      } else {
        if (dockerExisting && !dockerExisting.running) {
          let start = await startDockerPostgres({ connectionString, timeoutSeconds: 90 });
          if (!start.success && start.message.includes("not ready yet")) {
            setDockerStatus({ success: false, message: start.message });
            const ready = await waitForPostgresReady(connectionString);
            if (ready) {
              start = { ...start, success: true, message: t("dockerStartSuccess") };
            }
          }
          if (!start.success) {
            setDockerStatus({ success: false, message: t("dockerStartFailed") });
            setStepError("database", start.message);
            setDockerPhase(null);
            return;
          }
        }
        setDockerStatus({ success: true, message: t("dockerUsingExisting") });
      }

      setDockerPhase("database");
      await runDockerProvision(connectionString);
    } catch (err) {
      const message = getErrorMessage(err, t("dockerStartFailed"));
      setDockerStatus({ success: false, message: t("dockerStartFailed") });
      setStepError("database", message);
      setDockerPhase(null);
      setShowDockerBackupFallback(backup);
    } finally {
      setIsStartingDocker(false);
    }
  };

  const handleDockerRecreateWithoutBackup = async () => {
    setIsStartingDocker(true);
    setDockerStatus(null);
    setDockerPhase("container");
    setDockerPhaseMessage(null);
    setShowDockerPrompt(false);
    setError("");
    setErrorStep(null);
    setDockerBackupInProgress(false);
    setDockerBackupPath(null);

    const host = "localhost";
    const port = "5432";
    const name = "puod";
    const user = dbUser.trim();
    const password = dbPassword;

    if (!user || !password) {
      setIsStartingDocker(false);
      setDockerPhase(null);
      setStepError("database", t("fillUserPassword"));
      return;
    }

    const connectionString = `Host=${host};Port=${port};Database=${name};Username=${user};Password=${password};SSL Mode=prefer`;

    try {
      const response = await recreateDockerPostgres({
        connectionString,
        backup: false,
      });
      if (!response.success) {
        setDockerStatus({ success: false, message: t("dockerStartFailed") });
        setStepError("database", response.message);
        setDockerPhase(null);
        return;
      }
      setDockerPhase("database");
      let start = await startDockerPostgres({ connectionString, timeoutSeconds: 90 });
      if (!start.success && start.message.includes("not ready yet")) {
        setDockerStatus({ success: false, message: start.message });
        const ready = await waitForPostgresReady(connectionString);
        if (ready) {
          start = { ...start, success: true, message: t("dockerStartSuccess") };
        }
      }
      if (!start.success) {
        setDockerStatus({ success: false, message: t("dockerStartFailed") });
        setStepError("database", start.message);
        setDockerPhase(null);
        return;
      }
      await runDockerProvision(connectionString);
    } catch (err) {
      const message = getErrorMessage(err, t("dockerStartFailed"));
      setDockerStatus({ success: false, message: t("dockerStartFailed") });
      setStepError("database", message);
      setDockerPhase(null);
    } finally {
      setIsStartingDocker(false);
      setShowDockerBackupFallback(false);
    }
  };

  const openDockerResetPrompt = async () => {
    setError("");
    setErrorStep(null);
    try {
      const status = await getDockerPostgresStatus();
      setDockerExisting(status);
      if (!status.exists) {
        setStepError("database", t("dockerNoContainer"));
        return;
      }
      setShowDockerPrompt(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("dockerStartFailed");
      setStepError("database", message);
    }
  };

  const provisionDatabaseSchema = async () => {
    if (!databaseConfigured) {
      setStepError("database", t("setupDatabaseFirst"));
      return;
    }
    if (!testStatus || !testStatus.success) {
      setStepError("database", t("databaseTestRequired"));
      return;
    }

    setIsProvisioning(true);
    setError("");
    setErrorStep(null);
    setProvisionStatus(null);
    try {
      const response = await provisionDatabase();
      setDbStatus(response);
      setProvisionStatus({ success: true, message: t("provisionSuccess") });
      showToast(t("provisionSuccess"), { title: t("provisionTitle"), variant: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : t("provisionFailed");
      setProvisionStatus({ success: false, message });
      setStepError("database", message);
    } finally {
      setIsProvisioning(false);
    }
  };

  const saveAdminStep = async () => {
    if (!adminName.trim() || !adminEmail.trim()) {
      setStepError("admin", t("adminRequired"));
      return;
    }
    if (!adminPassword.trim() && !adminPasswordSaved) {
      setStepError("admin", t("adminPasswordRequired"));
      return;
    }
    setStepSaving("admin");
    setError("");
    setErrorStep(null);
    try {
      const data: Record<string, string | null> = {
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword: adminPassword || null,
      };
      if (!adminPassword.trim() && adminPasswordSaved) {
        delete data.adminPassword;
      }
      await saveSetupStep({ stepId: "admin", data, isCompleted: true });
      await refreshSetupSteps();
      setAdminPassword("");
      if (adminPasswordSaved || adminPassword.trim()) {
        setAdminPasswordSaved(true);
      }
      showToast(t("stepSaved"), { title: t("admin"), variant: "success" });
    } catch (err) {
      const message = getErrorMessage(err, t("stepSaveFailed"));
      setStepError("admin", message);
    } finally {
      setStepSaving(null);
    }
  };

  const clearAdminStep = async () => {
    if (!window.confirm(t("clearStepConfirm"))) {
      return;
    }
    setStepClearing("admin");
    setError("");
    setErrorStep(null);
    try {
      await clearSetupStep({ stepId: "admin" });
      await refreshSetupSteps();
      setAdminEmail(t("defaultAdminEmail"));
      setAdminName(t("defaultAdminName"));
      setAdminPassword("");
      setShowAdminPassword(false);
      setAdminPasswordSaved(false);
      showToast(t("stepCleared"), { title: t("admin"), variant: "default" });
    } catch (err) {
      const message = getErrorMessage(err, t("stepClearFailed"));
      setStepError("admin", message);
    } finally {
      setStepClearing(null);
    }
  };

  const saveAuthStep = async () => {
    if (authAd && (!windowsAdDomain.trim() || !windowsAdLdapUrl.trim() || !windowsAdBaseDn.trim())) {
      setStepError("auth", t("windowsAdRequired"));
      return;
    }

    if (
      authAzure &&
      (!azureTenantId.trim() ||
        !azureClientId.trim() ||
        (!azureClientSecret.trim() && !authAzureSecretSaved) ||
        !azureRedirectUri.trim() ||
        !azureAuthUrl.trim() ||
        !azureTokenUrl.trim())
    ) {
      setStepError("auth", t("azureAdRequired"));
      return;
    }

    setStepSaving("auth");
    setError("");
    setErrorStep(null);
    try {
      const data: Record<string, string | null> = {
        authLocal: authLocal ? "true" : "false",
        authAd: authAd ? "true" : "false",
        authAzure: authAzure ? "true" : "false",
        windowsAdDomain: windowsAdDomain.trim(),
        windowsAdLdapUrl: windowsAdLdapUrl.trim(),
        windowsAdBaseDn: windowsAdBaseDn.trim(),
        windowsAdBindDn: windowsAdBindDn.trim(),
        windowsAdBindPassword: windowsAdBindPassword || null,
        windowsAdUserFilter: windowsAdUserFilter.trim(),
        windowsAdGroupFilter: windowsAdGroupFilter.trim(),
        windowsAdUseSsl: windowsAdUseSsl ? "true" : "false",
        windowsAdStartTls: windowsAdStartTls ? "true" : "false",
        windowsAdTimeoutSeconds: windowsAdTimeoutSeconds.trim(),
        azureTenantId: azureTenantId.trim(),
        azureClientId: azureClientId.trim(),
        azureClientSecret: azureClientSecret || null,
        azureAuthUrl: azureAuthUrl.trim(),
        azureTokenUrl: azureTokenUrl.trim(),
        azureAuthority: azureAuthority.trim(),
        azureRedirectUri: azureRedirectUri.trim(),
        azureScopes: azureScopes.trim(),
        azureIssuer: azureIssuer.trim(),
        azureUsePkce: azureUsePkce ? "true" : "false",
      };

      if (!windowsAdBindPassword.trim() && authBindPasswordSaved) {
        delete data.windowsAdBindPassword;
      }
      if (!azureClientSecret.trim() && authAzureSecretSaved) {
        delete data.azureClientSecret;
      }

      await saveSetupStep({ stepId: "auth", data, isCompleted: true });
      await refreshSetupSteps();
      if (windowsAdBindPassword.trim() || authBindPasswordSaved) {
        setWindowsAdBindPassword("");
        setAuthBindPasswordSaved(true);
      }
      if (azureClientSecret.trim() || authAzureSecretSaved) {
        setAzureClientSecret("");
        setAuthAzureSecretSaved(true);
      }
      showToast(t("stepSaved"), { title: t("auth"), variant: "success" });
    } catch (err) {
      const message = getErrorMessage(err, t("stepSaveFailed"));
      setStepError("auth", message);
    } finally {
      setStepSaving(null);
    }
  };

  const clearAuthStep = async () => {
    if (!window.confirm(t("clearStepConfirm"))) {
      return;
    }
    setStepClearing("auth");
    setError("");
    setErrorStep(null);
    try {
      await clearSetupStep({ stepId: "auth" });
      await refreshSetupSteps();
      setAuthLocal(true);
      setAuthAd(false);
      setAuthAzure(true);
      setWindowsAdDomain("");
      setWindowsAdLdapUrl("");
      setWindowsAdBaseDn("");
      setWindowsAdBindDn("");
      setWindowsAdBindPassword("");
      setWindowsAdUserFilter("");
      setWindowsAdGroupFilter("");
      setWindowsAdUseSsl(true);
      setWindowsAdStartTls(false);
      setWindowsAdTimeoutSeconds("15");
      setShowWindowsAdvanced(false);
      setShowBindPassword(false);
      setAzureTenantId("");
      setAzureClientId("");
      setAzureClientSecret("");
      setAzureAuthUrl("");
      setAzureTokenUrl("");
      setAzureAuthority("");
      setAzureRedirectUri("");
      setAzureScopes("openid profile email");
      setAzureIssuer("");
      setAzureUsePkce(true);
      setShowAzureAdvanced(false);
      setShowAzureSecret(false);
      setAuthBindPasswordSaved(false);
      setAuthAzureSecretSaved(false);
      showToast(t("stepCleared"), { title: t("auth"), variant: "default" });
    } catch (err) {
      const message = getErrorMessage(err, t("stepClearFailed"));
      setStepError("auth", message);
    } finally {
      setStepClearing(null);
    }
  };

  const completeSetup = async () => {
    if (!databaseProvisioned) {
      setStepError("summary", t("setupDatabaseFirst"));
      return;
    }

    if (dbRequiresRestart) {
      setStepError("summary", t("restartUserService"));
      return;
    }

    if (!databaseProvisioned) {
      setStepError("summary", t("provisionRequired"));
      return;
    }

    if (!adminStepCompleted || !authStepCompleted) {
      setStepError("summary", t("saveStepsBeforeFinish"));
      return;
    }

    if (authAd && (!windowsAdDomain.trim() || !windowsAdLdapUrl.trim() || !windowsAdBaseDn.trim())) {
      setStepError("summary", t("windowsAdRequired"));
      return;
    }

    if (
      authAzure &&
      (!azureTenantId.trim() ||
        !azureClientId.trim() ||
        (!azureClientSecret.trim() && !authAzureSecretSaved) ||
        !azureRedirectUri.trim() ||
        !azureAuthUrl.trim() ||
        !azureTokenUrl.trim())
    ) {
      setStepError("summary", t("azureAdRequired"));
      return;
    }

    setIsBusy(true);
    setError("");
    setErrorStep(null);
    try {
      const payload = {
        adminEmail,
        adminPassword: adminPassword.trim() ? adminPassword : undefined,
        adminName,
        enableLocalAuth: authLocal,
        enableWindowsAd: authAd,
        enableAzureAd: authAzure,
        windowsAdDomain: windowsAdDomain.trim() || undefined,
        windowsAdLdapUrl: windowsAdLdapUrl.trim() || undefined,
        windowsAdBaseDn: windowsAdBaseDn.trim() || undefined,
        windowsAdBindDn: windowsAdBindDn.trim() || undefined,
        windowsAdBindPassword: windowsAdBindPassword || undefined,
        windowsAdUserFilter: windowsAdUserFilter.trim() || undefined,
        windowsAdGroupFilter: windowsAdGroupFilter.trim() || undefined,
        windowsAdUseSsl,
        windowsAdStartTls,
        windowsAdTimeoutSeconds: Number.isNaN(Number(windowsAdTimeoutSeconds))
          ? undefined
          : Number(windowsAdTimeoutSeconds),
        azureTenantId: azureTenantId.trim() || undefined,
        azureClientId: azureClientId.trim() || undefined,
        azureClientSecret: azureClientSecret || undefined,
        azureAuthUrl: azureAuthUrl.trim() || undefined,
        azureTokenUrl: azureTokenUrl.trim() || undefined,
        azureAuthority: azureAuthority.trim() || undefined,
        azureRedirectUri: azureRedirectUri.trim() || undefined,
        azureScopes: azureScopes.trim() || undefined,
        azureIssuer: azureIssuer.trim() || undefined,
        azureUsePkce,
      };

      await initializeSetup(payload);
      sessionStorage.setItem("toast:setupComplete", "1");
      window.location.href = "/dashboard";
    } catch (err) {
      const message = err instanceof Error ? err.message : t("setupFailed");
      setStepError("summary", message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -left-12 top-8 h-32 w-32 rounded-full bg-emerald-400/40 blur-2xl" />
          <div className="absolute right-6 top-4 h-44 w-44 rounded-full bg-amber-400/40 blur-3xl" />
        </div>
        <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-300">{t("setupEyebrow")}</p>
            <h1 className="text-3xl font-semibold">{t("setupTitle")}</h1>
            <p className="text-sm text-slate-300">{t("setupSubtitle")}</p>
            <p className="mt-2 text-xs text-slate-300">{statusMessage}</p>
          </div>
          <div className="w-full max-w-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>{t("progress")}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-emerald-300/80 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                  <path d="M5 5h14v4H5zM5 10h14v4H5zM5 15h14v4H5z" fill="currentColor" />
                </svg>
              </span>
              {t("steps")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, index) => {
              const stepComplete =
                step.id === "database"
                  ? databaseProvisioned
                  : step.id === "admin"
                    ? adminStepCompleted
                    : step.id === "auth"
                      ? authStepCompleted
                      : databaseProvisioned && adminStepCompleted && authStepCompleted;
              const stepSavedAtLabel =
                step.id === "admin" ? adminStepSavedAt : step.id === "auth" ? authStepSavedAt : null;
              const canOpen =
                step.id === "database" ||
                (databaseProvisioned && (step.id !== "summary" || (adminStepCompleted && authStepCompleted)));
              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (!canOpen) {
                      return;
                    }
                    setStepIndex(index);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    index === stepIndex
                      ? "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-900/30"
                      : "border-border bg-white dark:bg-slate-950/60"
                  }`}
                  disabled={!canOpen}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                          index === stepIndex
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <p className="font-medium text-foreground">{t(step.titleKey)}</p>
                    </div>
                    {stepComplete ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                        {t("stepSaved")}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{t(step.captionKey)}</p>
                  {stepSavedAtLabel ? (
                    <p className="text-[10px] text-muted-foreground">
                      {t("savedAt")} {new Date(stepSavedAtLabel).toLocaleString()}
                    </p>
                  ) : null}
                </button>
              );
            })}
            <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {t("adminOnlyNote")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                  <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              {t(activeStep.titleKey)}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t(activeStep.captionKey)}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {shouldShowError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <p className="font-semibold text-amber-700">
                  {isValidationError ? t("requiredFieldsHint") : t("setupFailed")}
                </p>
                <p className="mt-1 text-destructive">{error}</p>
              </div>
            ) : null}
            {activeStep.id === "database" && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground font-normal text-sm">{t("provider" as any)}</Label>
                    <select
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                      value={dbProviderChoice}
                      onChange={(event) =>
                        setDbProviderChoice(
                          event.target.value as "postgres-docker" | "postgres" | "sqlserver" | "mysql"
                        )
                      }
                    >
                      <option value="postgres-docker">{t("providerDocker")}</option>
                      <option value="postgres">{t("providerExternal")}</option>
                      <option value="sqlserver">{t("sqlServerLabel")}</option>
                      <option value="mysql">{t("mysqlLabel")}</option>
                    </select>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-slate-50/70 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950/60 dark:text-slate-200">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {t("currentDatabase")}
                    </p>
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <span className="break-all text-slate-900 dark:text-slate-100">
                        {dbStatus?.provider ?? t("defaultValue")} -{" "}
                        {dbStatus?.connectionStringMasked ?? t("notDefined")}
                      </span>
                      <span className="inline-flex shrink-0 items-center rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2 py-0.5 text-[10px] uppercase text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-200">
                        {providerBadge()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  {!isDockerProvider ? (
                    <>
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">{t("host")}</span>
                    <input
                      className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                        dbFieldError(dbHost) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                      }`}
                      value={dbHost}
                      onChange={(event) => setDbHost(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">{t("port")}</span>
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                      value={dbPort}
                      onChange={(event) => setDbPort(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">{t("databaseName")}</span>
                    <input
                      className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                        dbFieldError(dbName) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                      }`}
                      value={dbName}
                      onChange={(event) => setDbName(event.target.value)}
                    />
                  </label>
                    </>
                  ) : null}
                  <label className="space-y-2 text-sm">
                    <span className="text-muted-foreground">{t("user" as any)}</span>
                    <input
                      className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                        dbFieldError(dbUser) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                      }`}
                      disabled={isDockerProvider && dockerConfigured}
                      value={dbUser}
                      onChange={(event) => setDbUser(event.target.value)}
                    />
                  </label>
                  <label className="space-y-2 text-sm md:col-span-2">
                    <span className="text-muted-foreground">{t("password")}</span>
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        className={`min-w-[220px] flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                          dbFieldError(dbPassword) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                        }`}
                        type={dbShowPassword ? "text" : "password"}
                        value={dbPassword}
                        onChange={(event) => setDbPassword(event.target.value)}
                      />
                      <Button size="sm" variant="outline" className="gap-2" onClick={generateSecurePassword}>
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                          <path d="M5 12h14M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        {t("generatePassword")}
                      </Button>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={dbShowPassword}
                          onChange={(event) => setDbShowPassword(event.target.checked)}
                        />
                        {t("showPassword")}
                      </label>
                    </div>
                  </label>
                </div>
                <div className="grid gap-3">
                  <div className="grid gap-3 rounded-lg border border-dashed bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                    <div className="flex items-start gap-2">
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <rect x="3" y="14" width="18" height="6" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      <span className="text-balance">{t("dockerManagedInfo")}</span>
                    </div>
                  </div>
                  {dbProviderChoice === "postgres-docker" ? (
                    <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:bg-sky-500/10 dark:text-sky-100">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-foreground">{t("dockerManagedTitle")}</p>
                            <p className="text-[11px] text-muted-foreground">{t("dockerManagedBody")}</p>
                            {dockerConfigured && dockerDetectedUser ? (
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {t("dockerDetectedUser")}: <span className="text-foreground">{dockerDetectedUser}</span>
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {!dockerHasContainer ? (
                              <Button
                                size="sm"
                                className="gap-2"
                                onClick={startDockerDatabase}
                                disabled={isStartingDocker || !dbUser.trim() || !dbPassword.trim()}
                              >
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                                  <path d="M4 12h6v6H4zM14 6h6v6h-6z" fill="currentColor" />
                                </svg>
                                {isStartingDocker ? t("dockerStarting") : t("dockerStartAction")}
                              </Button>
                            ) : null}
                            {dockerHasContainer ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-2"
                                onClick={openDockerResetPrompt}
                                disabled={isStartingDocker}
                              >
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                                  <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                {t("dockerReset")}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      {showDockerPrompt && dockerHasContainer && dockerConfigured ? (
                        <div className="mt-3 rounded-md border border-amber-400/40 bg-amber-100/60 px-3 py-2 text-[11px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
                          <p className="font-semibold text-foreground">{t("dockerExistingTitle")}</p>
                          <p className="mt-1 text-muted-foreground">{t("dockerExistingBody")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleDockerExisting(true)}>
                              {t("dockerBackupAndRecreate")}
                            </Button>
                            <Button size="sm" onClick={() => setShowDockerPrompt(false)}>
                              {t("dockerCancel")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {showDockerPrompt && dockerHasContainer && !dockerConfigured ? (
                        <div className="mt-3 rounded-md border border-rose-400/40 bg-rose-100/70 px-3 py-2 text-[11px] text-rose-900 dark:bg-rose-500/10 dark:text-rose-100">
                          <p className="font-semibold text-foreground">{t("dockerContainerMismatchTitle")}</p>
                          <p className="mt-1 text-muted-foreground">{t("dockerContainerMismatchBody")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={handleDockerRecreateWithoutBackup}>
                              {t("dockerRecreateWithoutBackup")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {showDockerBackupFallback ? (
                        <div className="mt-3 rounded-md border border-rose-400/40 bg-rose-100/70 px-3 py-2 text-[11px] text-rose-900 dark:bg-rose-500/10 dark:text-rose-100">
                          <p className="font-semibold text-foreground">{t("dockerBackupFailedTitle")}</p>
                          <p className="mt-1 text-muted-foreground">{t("dockerBackupFailedBody")}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={handleDockerRecreateWithoutBackup}>
                              {t("dockerRecreateWithoutBackup")}
                            </Button>
                            <Button size="sm" onClick={() => setShowDockerBackupFallback(false)}>
                              {t("dockerCancel")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {dockerStatus ? (
                        <p
                          className={`mt-2 text-[11px] ${
                            dockerStatus.success ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {dockerStatus.message}
                        </p>
                      ) : null}
                      {dockerPhaseMessage ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">{dockerPhaseMessage}</p>
                      ) : null}
                      <div className="mt-2 grid gap-2 text-[11px] text-muted-foreground">
                        {dockerBackupInProgress || dockerBackupFileName ? (
                          <div className="flex items-center justify-between">
                            <span>{t("dockerStepBackup")}</span>
                            <span
                              className={
                                dockerBackupStepState() === "running"
                                  ? "text-amber-600"
                                  : dockerBackupStepState() === "done"
                                    ? "text-emerald-600"
                                    : "text-muted-foreground"
                              }
                            >
                              {dockerBackupStepState() === "running"
                                ? t("dockerStepRunning")
                                : dockerBackupStepState() === "done"
                                  ? t("dockerStepDone")
                                  : t("dockerStepPending")}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between">
                          <span>{t("dockerStepContainer")}</span>
                          <span
                            className={
                              dockerStepState("container") === "running"
                                ? "text-amber-600"
                                : dockerStepState("container") === "done"
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                            }
                          >
                            {dockerStepState("container") === "running"
                              ? t("dockerStepRunning")
                              : dockerStepState("container") === "done"
                                ? t("dockerStepDone")
                                : t("dockerStepPending")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("dockerStepDatabase")}</span>
                          <span
                            className={
                              dockerStepState("database") === "running"
                                ? "text-amber-600"
                                : dockerStepState("database") === "done"
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                            }
                          >
                            {dockerStepState("database") === "running"
                              ? t("dockerStepRunning")
                              : dockerStepState("database") === "done"
                                ? t("dockerStepDone")
                                : t("dockerStepPending")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t("dockerStepTables")}</span>
                          <span
                            className={
                              dockerStepState("tables") === "running"
                                ? "text-amber-600"
                                : dockerStepState("tables") === "done"
                                  ? "text-emerald-600"
                                  : "text-muted-foreground"
                            }
                          >
                            {dockerStepState("tables") === "running"
                              ? t("dockerStepRunning")
                              : dockerStepState("tables") === "done"
                                ? t("dockerStepDone")
                                : t("dockerStepPending")}
                          </span>
                        </div>
                      </div>
                      {dockerBackupFileName ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-200">
                            {t("dockerBackupReady")}
                          </span>
                          <a
                            className="text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-200"
                            href={getDockerPostgresBackupUrl(dockerBackupFileName)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("dockerDownloadBackup")}
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {isDockerProvider ? (
                  <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {t("dockerManagedFieldsNote")}
                  </div>
                ) : null}
                <details className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-muted-foreground">
                    {t("generatedString")}
                  </summary>
                  <div className="mt-2 max-h-28 overflow-auto break-all whitespace-pre-wrap text-[11px] text-foreground">
                    {connectionStringValue || t("generatedEmpty")}
                  </div>
                </details>
                {!isDockerProvider ? (
                  <>
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={dbUseCustom}
                          onChange={(event) => setDbUseCustom(event.target.checked)}
                        />
                        {t("customConnectionString")}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={showDbAdvanced}
                          onChange={(event) => setShowDbAdvanced(event.target.checked)}
                        />
                        <span className="inline-flex items-center gap-1">
                          {t("advancedSecurity")}
                          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
                            <path d="M12 2l4 4-4 4-4-4z" fill="currentColor" />
                            <path d="M12 12l4 4-4 4-4-4z" fill="currentColor" />
                          </svg>
                        </span>
                      </label>
                    </div>
                    {showDbAdvanced ? (
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applySecurityPreset("docker")}
                      >
                        {t("presetDocker")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => applySecurityPreset("strict")}
                      >
                        {t("presetSecure")}
                      </Button>
                    </div>
                    <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
                      {t("securityActive")}: {securitySummary()}
                    </div>
                    <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground md:col-span-2">
                      {effectiveProvider === "sqlserver"
                        ? t("securityHintSqlServer")
                        : effectiveProvider === "mysql"
                          ? t("securityHintMySql")
                          : t("securityHintPostgres")}
                    </div>
                    {effectiveProvider === "sqlserver" ? (
                      <>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={dbTrustServerCertificate}
                            onChange={(event) => setDbTrustServerCertificate(event.target.checked)}
                          />
                          {t("trustServerCertificate")}
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("minTlsVersion")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={dbTlsMinVersion}
                            onChange={(event) => setDbTlsMinVersion(event.target.value)}
                            placeholder="1.2"
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("sslMode")}</span>
                          <select
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={dbSslMode}
                            onChange={(event) => setDbSslMode(event.target.value)}
                          >
                            {effectiveProvider === "mysql" ? (
                              <>
                                <option value="Preferred">{t("sslModePreferred")}</option>
                                <option value="Required">{t("sslModeRequired")}</option>
                                <option value="VerifyCA">{t("sslModeVerifyCa")}</option>
                                <option value="VerifyFull">{t("sslModeVerifyFull")}</option>
                                <option value="Disabled">{t("sslModeDisabled")}</option>
                              </>
                            ) : (
                              <>
                                <option value="prefer">{t("sslModePreferLower")}</option>
                                <option value="require">{t("sslModeRequireLower")}</option>
                                <option value="verify-ca">{t("sslModeVerifyCaLower")}</option>
                                <option value="verify-full">{t("sslModeVerifyFullLower")}</option>
                                <option value="disable">{t("sslModeDisableLower")}</option>
                              </>
                            )}
                          </select>
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("minTlsVersion")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={dbTlsMinVersion}
                            onChange={(event) => setDbTlsMinVersion(event.target.value)}
                            placeholder="1.2"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("rootCaPath")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={dbSslRootCert}
                            onChange={(event) => setDbSslRootCert(event.target.value)}
                            placeholder="C:\\certs\\root-ca.crt"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("clientCertPath")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={dbSslCert}
                            onChange={(event) => setDbSslCert(event.target.value)}
                            placeholder="C:\\certs\\client.crt"
                          />
                        </label>
                        <label className="space-y-2 text-sm">
                          <span className="text-muted-foreground">{t("clientKeyPath")}</span>
                          <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={dbSslKey}
                            onChange={(event) => setDbSslKey(event.target.value)}
                            placeholder="C:\\certs\\client.key"
                          />
                        </label>
                      </>
                    )}
                  </div>
                    ) : null}
                    <details className="space-y-2 text-sm" open={dbUseCustom}>
                      <summary className="cursor-pointer text-muted-foreground">
                        {t("connectionStringTitle")}
                      </summary>
                      <textarea
                        className={`min-h-[88px] w-full resize-none rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                          dbFieldError(connectionStringValue) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                        }`}
                        value={dbUseCustom ? dbConnection : connectionStringValue}
                        onChange={(event) => setDbConnection(event.target.value)}
                        placeholder="Host=localhost;Port=5432;Database=puod;Username=puod_user;Password=puod_dev_password_2024"
                        disabled={!dbUseCustom}
                      />
                    </details>
                  </>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowDbExamples((prev) => !prev)}
                  >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                      <path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    {showDbExamples ? t("hideExamples") : t("showExamples")}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {t("testRequiredNote")}
                  </span>
                </div>
                {showDbExamples ? (
                  <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground dark:bg-slate-900/40">
                    <div className="max-h-28 space-y-2 overflow-y-auto pr-2">
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-foreground">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
                              <path d="M12 3c4 0 7 2 7 4s-3 4-7 4-7-2-7-4 3-4 7-4z" fill="currentColor" />
                              <path d="M5 11c0 2 3 4 7 4s7-2 7-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M5 15c0 2 3 4 7 4s7-2 7-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                            </svg>
                          </span>
                        {t("postgresLabel")}
                        </p>
                        <pre className="whitespace-pre-wrap break-all text-[10px]">
Host=host;Port=5432;Database=puod;Username=puod_user;Password=senha;SSL Mode=verify-full;Root Certificate=C:\certs\root.crt;SSL Certificate=C:\certs\client.crt;SSL Key=C:\certs\client.key
                        </pre>
                      </div>
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-foreground">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
                              <rect x="4" y="5" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                              <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </span>
                        {t("sqlServerLabel")}
                        </p>
                        <pre className="whitespace-pre-wrap break-all text-[10px]">
Server=host,1433;Database=puod;User Id=sa;Password=senha;Encrypt=True;TrustServerCertificate=False;MinTLSVersion=1.2
                        </pre>
                      </div>
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-foreground">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24">
                              <path d="M6 7h12M6 12h12M6 17h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </span>
                        {t("mysqlLabel")}
                        </p>
                        <pre className="whitespace-pre-wrap break-all text-[10px]">
Server=host;Port=3306;Database=puod;User=puod_user;Password=senha;SslMode=VerifyFull;TlsVersion=1.2;SslCa=C:\certs\root.crt;SslCert=C:\certs\client.crt;SslKey=C:\certs\client.key
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                  {t("permissionsRequired")}
                </div>
                {testStatus && !isDockerProvider ? (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      testStatus.success
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {testStatus.success ? t("databaseTestSuccess") : t("databaseTestFailed")} ({testStatus.elapsed}ms)
                      </span>
                      <span className="text-[11px]">
                        {testStatus.success ? t("connectionValid") : t("detailsBelow")}
                      </span>
                    </div>
                    {!testStatus.success ? (
                      <>
                        <pre className="mt-2 whitespace-pre-wrap text-[11px] text-destructive/90">
                          {showFullTestError || testStatus.message.length <= 220
                            ? testStatus.message
                            : `${testStatus.message.slice(0, 220)}...`}
                        </pre>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {testStatus.message.length > 220 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowFullTestError((prev) => !prev)}
                            >
                              {showFullTestError ? t("hideDetails") : t("showDetails")}
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigator.clipboard.writeText(testStatus.message)}
                          >
                            {t("copyError")}
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
                {!isDockerProvider ? (
                  <>
                    <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{t("provisionTitle")}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {dbStatus?.provisionedAt
                              ? `${t("provisionedAt")} ${new Date(dbStatus.provisionedAt).toLocaleString()}`
                              : t("provisionPending")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isProvisioning || !databaseConfigured || !testStatus?.success}
                          onClick={provisionDatabaseSchema}
                        >
                          {isProvisioning ? t("provisioning") : t("provisionAction")}
                        </Button>
                      </div>
                      {provisionStatus ? (
                        <p
                          className={`mt-2 text-[11px] ${
                            provisionStatus.success ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {provisionStatus.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-2" onClick={testDatabase} disabled={isTesting || !connectionStringValue}>
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                          <path d="M4 12h4l2-4 4 8 2-4h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        {isTesting ? t("testing") : t("testConnection")}
                      </Button>
                      <Button size="sm" className="gap-2" onClick={saveDatabase} disabled={isBusy || !connectionStringValue || !testStatus || !testStatus.success}>
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                          <path d="M5 20h14V8l-4-4H5z" fill="none" stroke="currentColor" strokeWidth="2" />
                          <path d="M7 20v-6h10v6M7 4v4h8" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        {isBusy ? t("saving") : t("saveDatabase")}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("restartRequiredNote")}</p>
                  </>
                ) : null}

              </div>
            )}

            {activeStep.id === "admin" && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M4 20c1.5-3 5-5 8-5s6.5 2 8 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    {t("admin")}
                  </span>
                  <input
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                      fieldError("admin", adminName) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                    }`}
                    value={adminName}
                    onChange={(event) => setAdminName(event.target.value)}
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                      <path d="M4 6h16v12H4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M4 7l8 5 8-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    {t("adminUser")}
                  </span>
                  <input
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                      fieldError("admin", adminEmail) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                    }`}
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                  />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                      <path d="M6 10h12v10H6z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M8 10V7a4 4 0 1 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                    {t("initialPassword")}
                  </span>
                  <input
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
                      fieldError("admin", adminPassword) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                    }`}
                    type={showAdminPassword ? "text" : "password"}
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAdminPassword}
                      onChange={(event) => setShowAdminPassword(event.target.checked)}
                    />
                    {t("showPassword")}
                  </label>
                  {adminPasswordSaved && !adminPassword ? (
                    <p className="text-[11px] text-emerald-600">{t("passwordSavedHint")}</p>
                  ) : null}
                </label>
                <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground md:col-span-2">
                  {t("initialRoles")}
                </div>
                <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                  <Button size="sm" className="gap-2" onClick={saveAdminStep} disabled={stepSaving === "admin"}>
                    {stepSaving === "admin" ? t("saving") : t("saveStep")}
                  </Button>
                  {adminStepCompleted ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={clearAdminStep}
                      disabled={stepClearing === "admin"}
                    >
                      {stepClearing === "admin" ? t("clearing") : t("clearSavedData")}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}

            {activeStep.id === "auth" && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={authLocal}
                      onChange={(event) => setAuthLocal(event.target.checked)}
                    />
                    <span className="inline-flex items-center gap-2">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                        <path d="M5 11h14M5 7h14M5 15h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                      {t("localAuth")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={authAd}
                      onChange={(event) => setAuthAd(event.target.checked)}
                    />
                    <span className="inline-flex items-center gap-2">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                        <path d="M4 6h16v12H4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                      {t("windowsAd")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={authAzure}
                      onChange={(event) => setAuthAzure(event.target.checked)}
                    />
                    <span className="inline-flex items-center gap-2">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                        <path d="M12 3l8 6-8 12-8-12z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                      {t("azureAd")}
                    </span>
                  </label>
                </div>
                <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {t("authProfilesHint")}
                </div>

                {authAd ? (
                  <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{t("windowsAdSectionTitle")}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowWindowsAdvanced((prev) => !prev)}
                      >
                        {showWindowsAdvanced ? t("hideAdvanced") : t("showAdvanced")}
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("windowsAdBasicHint")}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="text-muted-foreground">{t("windowsAdDomain")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", windowsAdDomain) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          value={windowsAdDomain}
                          onChange={(event) => setWindowsAdDomain(event.target.value)}
                          placeholder="corp.local"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-muted-foreground">{t("windowsAdLdapUrl")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", windowsAdLdapUrl) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          value={windowsAdLdapUrl}
                          onChange={(event) => setWindowsAdLdapUrl(event.target.value)}
                          placeholder="ldap://ldap.corp.local:389"
                        />
                      </label>
                      <label className="space-y-2 text-sm md:col-span-2">
                        <span className="text-muted-foreground">{t("windowsAdBaseDn")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", windowsAdBaseDn) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          value={windowsAdBaseDn}
                          onChange={(event) => setWindowsAdBaseDn(event.target.value)}
                          placeholder="DC=corp,DC=local"
                        />
                      </label>
                    </div>

                    {showWindowsAdvanced ? (
                      <div className="mt-4 space-y-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{t("advancedSettings")}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("windowsAdBindDn")}</span>
                            <input
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              value={windowsAdBindDn}
                              onChange={(event) => setWindowsAdBindDn(event.target.value)}
                              placeholder="CN=svc_ldap,OU=Service,DC=corp,DC=local"
                            />
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("windowsAdBindPassword")}</span>
                            <input
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              type={showBindPassword ? "text" : "password"}
                              value={windowsAdBindPassword}
                              onChange={(event) => setWindowsAdBindPassword(event.target.value)}
                            />
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={showBindPassword}
                                onChange={(event) => setShowBindPassword(event.target.checked)}
                              />
                              {t("showPassword")}
                            </label>
                            {authBindPasswordSaved && !windowsAdBindPassword ? (
                              <p className="text-[11px] text-emerald-600">{t("secretSavedHint")}</p>
                            ) : null}
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("windowsAdUserFilter")}</span>
                            <input
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              value={windowsAdUserFilter}
                              onChange={(event) => setWindowsAdUserFilter(event.target.value)}
                              placeholder="(&(objectClass=user)(sAMAccountName={0}))"
                            />
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("windowsAdGroupFilter")}</span>
                            <input
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              value={windowsAdGroupFilter}
                              onChange={(event) => setWindowsAdGroupFilter(event.target.value)}
                              placeholder="(&(objectClass=group)(member={0}))"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={windowsAdUseSsl}
                              onChange={(event) => setWindowsAdUseSsl(event.target.checked)}
                            />
                            {t("windowsAdUseSsl")}
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={windowsAdStartTls}
                              onChange={(event) => setWindowsAdStartTls(event.target.checked)}
                            />
                            {t("windowsAdStartTls")}
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("windowsAdTimeout")}</span>
                            <input
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                            value={windowsAdTimeoutSeconds}
                            onChange={(event) => setWindowsAdTimeoutSeconds(event.target.value)}
                            placeholder="15"
                          />
                        </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {authAzure ? (
                  <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">{t("azureAdSectionTitle")}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowAzureAdvanced((prev) => !prev)}
                      >
                        {showAzureAdvanced ? t("hideAdvanced") : t("showAdvanced")}
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("azureAdBasicHint")}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-sm">
                        <span className="text-muted-foreground">{t("azureTenantId")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", azureTenantId) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          value={azureTenantId}
                          onChange={(event) => setAzureTenantId(event.target.value)}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-muted-foreground">{t("azureClientId")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", azureClientId) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          value={azureClientId}
                          onChange={(event) => setAzureClientId(event.target.value)}
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-muted-foreground">{t("azureClientSecret")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", azureClientSecret) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          type={showAzureSecret ? "text" : "password"}
                          value={azureClientSecret}
                          onChange={(event) => setAzureClientSecret(event.target.value)}
                        />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={showAzureSecret}
                            onChange={(event) => setShowAzureSecret(event.target.checked)}
                          />
                          {t("showPassword")}
                        </label>
                        {authAzureSecretSaved && !azureClientSecret ? (
                          <p className="text-[11px] text-emerald-600">{t("secretSavedHint")}</p>
                        ) : null}
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-muted-foreground">{t("azureRedirectUri")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", azureRedirectUri) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          value={azureRedirectUri}
                          onChange={(event) => setAzureRedirectUri(event.target.value)}
                          placeholder="https://app.local/auth/callback"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-muted-foreground">{t("azureAuthUrl")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", azureAuthUrl) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          value={azureAuthUrl}
                          onChange={(event) => setAzureAuthUrl(event.target.value)}
                          placeholder="https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize"
                        />
                      </label>
                      <label className="space-y-2 text-sm">
                        <span className="text-muted-foreground">{t("azureTokenUrl")}</span>
                        <input
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100 ${
                            fieldError("auth", azureTokenUrl) ? "border-red-400 focus-visible:ring-red-300" : "border-border"
                          }`}
                          value={azureTokenUrl}
                          onChange={(event) => setAzureTokenUrl(event.target.value)}
                          placeholder="https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token"
                        />
                      </label>
                    </div>

                    {showAzureAdvanced ? (
                      <div className="mt-4 space-y-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{t("advancedSettings")}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("azureAuthority")}</span>
                            <input
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              value={azureAuthority}
                              onChange={(event) => setAzureAuthority(event.target.value)}
                              placeholder="https://login.microsoftonline.com/{tenantId}"
                            />
                          </label>
                          <label className="space-y-2 text-sm">
                            <span className="text-muted-foreground">{t("azureIssuer")}</span>
                            <input
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              value={azureIssuer}
                              onChange={(event) => setAzureIssuer(event.target.value)}
                              placeholder="https://sts.windows.net/{tenantId}/"
                            />
                          </label>
                          <label className="space-y-2 text-sm md:col-span-2">
                            <span className="text-muted-foreground">{t("azureScopes")}</span>
                            <input
                              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground dark:bg-slate-950/60 dark:text-slate-100"
                              value={azureScopes}
                              onChange={(event) => setAzureScopes(event.target.value)}
                              placeholder="openid profile email offline_access"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={azureUsePkce}
                              onChange={(event) => setAzureUsePkce(event.target.checked)}
                            />
                            {t("azureUsePkce")}
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" className="gap-2" onClick={saveAuthStep} disabled={stepSaving === "auth"}>
                    {stepSaving === "auth" ? t("saving") : t("saveStep")}
                  </Button>
                  {authStepCompleted ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={clearAuthStep}
                      disabled={stepClearing === "auth"}
                    >
                      {stepClearing === "auth" ? t("clearing") : t("clearSavedData")}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}

            {activeStep.id === "summary" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M4 20c1.5-3 5-5 8-5s6.5 2 8 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </span>
                    {t("admin")}
                  </div>
                  <p className="mt-2 font-semibold">{adminName}</p>
                  <p className="text-xs text-muted-foreground">{adminEmail}</p>
                </div>
                <div className="rounded-xl border border-border/60 px-4 py-3 text-sm">
                  <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                        <path d="M5 7h14M5 12h10M5 17h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </span>
                    {t("auth")}
                  </div>
                  <p className="mt-2 font-semibold">{authSummary}</p>
                </div>
                <div className="rounded-xl border border-border/60 px-4 py-3 text-sm md:col-span-2">
                  <p className="text-xs uppercase text-muted-foreground">{t("nextSteps")}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-border/60 bg-slate-50 px-3 py-2 text-xs text-muted-foreground dark:bg-slate-900/40">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                            <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </span>
                        {t("nextStep1")}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-slate-50 px-3 py-2 text-xs text-muted-foreground dark:bg-slate-900/40">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                            <path d="M4 6h16v12H4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                            <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </span>
                        {t("nextStep2")}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-slate-50 px-3 py-2 text-xs text-muted-foreground dark:bg-slate-900/40">
                      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                            <path d="M4 5h16v6H4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                            <path d="M4 13h16v6H4z" fill="none" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        </span>
                        {t("nextStep3")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={!canBack || isBusy}
                onClick={() => setStepIndex(stepIndex - 1)}
                className="gap-2"
              >
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                  <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t("back")}
              </Button>
              {isLast ? (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={completeSetup}
                  disabled={isBusy || dbRequiresRestart || !databaseProvisioned || !adminStepCompleted || !authStepCompleted}
                >
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M5 12l4 4 10-10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {isBusy ? t("configuring") : t("finishSetup")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setStepIndex(stepIndex + 1)}
                  disabled={isBusy || !canContinueStep}
                  className="gap-2"
                >
                  {t("continue")}
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
