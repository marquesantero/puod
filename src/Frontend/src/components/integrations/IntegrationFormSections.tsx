import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/I18nContext";
import type { AuthProfileListResponse } from "@/lib/authProfileApi";
import type { IntegrationFormState } from "@/components/integrations/useIntegrationFormState";
import type {
  AirflowAuthType,
  AdfAuthType,
  SynapseAuthType,
  DatabricksAuthType,
  BrowserType,
} from "@/components/integrations/useIntegrationFormState";

type SetField = <K extends keyof IntegrationFormState>(
  key: K,
  value: IntegrationFormState[K]
) => void;

type CommonProps = {
  state: IntegrationFormState;
  setField: SetField;
  showSecret: boolean;
};

type ProfileProps = CommonProps & {
  authProfiles: AuthProfileListResponse[];
};

export const AirflowFields = ({ state, setField, showSecret, authProfiles }: ProfileProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t("integrationBaseUrl")}</Label>
        <Input
          value={state.airflowBaseUrl}
          onChange={(e) => setField("airflowBaseUrl", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("integrationAuthType")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
          value={state.airflowAuthType}
          onChange={(e) => setField("airflowAuthType", e.target.value as AirflowAuthType)}
        >
          <option value="cookie">{t("integrationAuthCookie")}</option>
          <option value="basic">{t("integrationAuthBasic")}</option>
          <option value="bearer">{t("integrationAuthBearer")}</option>
          <option value="company-profile">{t("integrationAuthCompanyProfile")}</option>
        </select>
      </div>
      {state.airflowAuthType === "company-profile" && (
        <div className="space-y-2">
          <Label>{t("integrationSelectProfile")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
            value={state.authProfileId}
            onChange={(event) => setField("authProfileId", Number(event.target.value))}
          >
            <option value={0}>{t("integrationSelectProfilePlaceholder")}</option>
            {authProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          {authProfiles.length === 0 && (
            <p className="text-xs text-amber-600">{t("integrationNoProfiles")}</p>
          )}
        </div>
      )}
      {state.airflowAuthType === "basic" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("username")}</Label>
            <Input
              autoComplete="off"
              name="airflow-username"
              value={state.airflowUsername}
              onChange={(e) => setField("airflowUsername", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("password")}</Label>
            <Input
              type={showSecret ? "text" : "password"}
              autoComplete="new-password"
              name="airflow-password"
              value={state.airflowPassword}
              onChange={(e) => setField("airflowPassword", e.target.value)}
            />
          </div>
        </div>
      )}
      {state.airflowAuthType === "bearer" && (
        <div className="space-y-2">
          <Label>{t("integrationToken")}</Label>
          <Input
            type={showSecret ? "text" : "password"}
            autoComplete="new-password"
            name="airflow-token"
            value={state.airflowToken}
            onChange={(e) => setField("airflowToken", e.target.value)}
          />
        </div>
      )}
      {state.airflowAuthType === "cookie" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("integrationCookieHeader")}</Label>
            <Input
              value={state.airflowCookieHeader}
              onChange={(e) => setField("airflowCookieHeader", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("integrationCookieHeaderHint")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("integrationBrowserType")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                value={state.airflowBrowserType}
                onChange={(e) => setField("airflowBrowserType", e.target.value as BrowserType)}
              >
                <option value="auto">{t("integrationBrowserAuto")}</option>
                <option value="vivaldi">Vivaldi</option>
                <option value="chrome">Chrome</option>
                <option value="edge">Edge</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("integrationBrowserProfile")}</Label>
              <Input
                value={state.airflowBrowserProfile}
                onChange={(e) => setField("airflowBrowserProfile", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("integrationCookieDomain")}</Label>
              <Input
                placeholder={t("integrationCookieDomainPlaceholder")}
                value={state.airflowCookieDomain}
                onChange={(e) => setField("airflowCookieDomain", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("integrationBrowserUserDataDir")}</Label>
              <Input
                value={state.airflowBrowserUserDataDir}
                onChange={(e) => setField("airflowBrowserUserDataDir", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SynapseFields = ({ state, setField, showSecret, authProfiles }: ProfileProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("integrationServer")}</Label>
          <Input
            value={state.synapseServer}
            onChange={(e) => setField("synapseServer", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("database")}</Label>
          <Input
            value={state.synapseDatabase}
            onChange={(e) => setField("synapseDatabase", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("integrationAuthType")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
          value={state.synapseAuthType}
          onChange={(e) => setField("synapseAuthType", e.target.value as SynapseAuthType)}
        >
          <option value="basic">{t("integrationAuthBasic")}</option>
          <option value="bearer">{t("integrationAuthBearer")}</option>
          <option value="company-profile">{t("integrationAuthCompanyProfile")}</option>
        </select>
      </div>
      {state.synapseAuthType === "company-profile" ? (
        <div className="space-y-2">
          <Label>{t("integrationSelectProfile")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
            value={state.authProfileId}
            onChange={(event) => setField("authProfileId", Number(event.target.value))}
          >
            <option value={0}>{t("integrationSelectProfilePlaceholder")}</option>
            {authProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          {authProfiles.length === 0 && (
            <p className="text-xs text-amber-600">{t("integrationNoProfiles")}</p>
          )}
        </div>
      ) : state.synapseAuthType === "basic" ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("username")}</Label>
            <Input
              autoComplete="off"
              name="synapse-username"
              value={state.synapseUsername}
              onChange={(e) => setField("synapseUsername", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("password")}</Label>
            <Input
              type={showSecret ? "text" : "password"}
              autoComplete="new-password"
              name="synapse-password"
              value={state.synapsePassword}
              onChange={(e) => setField("synapsePassword", e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{t("integrationToken")}</Label>
          <Input
            type={showSecret ? "text" : "password"}
            autoComplete="new-password"
            name="synapse-token"
            value={state.synapseToken}
            onChange={(e) => setField("synapseToken", e.target.value)}
          />
        </div>
      )}
    </div>
  );
};

type AdfProps = CommonProps & {
  authProfiles: AuthProfileListResponse[];
};

export const AdfFields = ({ state, setField, showSecret, authProfiles }: AdfProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("integrationSubscription")}</Label>
          <Input
            value={state.subscriptionId}
            onChange={(e) => setField("subscriptionId", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("integrationResourceGroup")}</Label>
          <Input
            value={state.resourceGroup}
            onChange={(e) => setField("resourceGroup", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("integrationFactory")}</Label>
        <Input
          value={state.factoryName}
          onChange={(e) => setField("factoryName", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("integrationAuthType")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
          value={state.adfAuthType}
          onChange={(e) => setField("adfAuthType", e.target.value as AdfAuthType)}
        >
          <option value="service-principal">{t("integrationAuthSpn")}</option>
          <option value="cookie">{t("integrationAuthCookie")}</option>
          <option value="company-profile">{t("integrationAuthCompanyProfile")}</option>
        </select>
      </div>
      {state.adfAuthType === "company-profile" && (
        <div className="space-y-2">
          <Label>{t("integrationSelectProfile")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
            value={state.authProfileId}
            onChange={(event) => setField("authProfileId", Number(event.target.value))}
          >
            <option value={0}>{t("integrationSelectProfilePlaceholder")}</option>
            {authProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          {authProfiles.length === 0 && (
            <p className="text-xs text-amber-600">{t("integrationNoProfiles")}</p>
          )}
        </div>
      )}
      {state.adfAuthType === "service-principal" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("integrationTenantId")}</Label>
            <Input
              autoComplete="off"
              name="adf-tenant-id"
              value={state.tenantId}
              onChange={(e) => setField("tenantId", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("integrationClientId")}</Label>
            <Input
              autoComplete="off"
              name="adf-client-id"
              value={state.clientId}
              onChange={(e) => setField("clientId", e.target.value)}
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>{t("integrationClientSecret")}</Label>
            <Input
              type={showSecret ? "text" : "password"}
              autoComplete="new-password"
              name="adf-client-secret"
              value={state.clientSecret}
              onChange={(e) => setField("clientSecret", e.target.value)}
            />
          </div>
        </div>
      )}
      {state.adfAuthType === "cookie" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("integrationCookieHeader")}</Label>
            <Input
              value={state.adfCookieHeader}
              onChange={(e) => setField("adfCookieHeader", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("integrationCookieHeaderHint")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("integrationBrowserType")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                value={state.adfBrowserType}
                onChange={(e) => setField("adfBrowserType", e.target.value as BrowserType)}
              >
                <option value="auto">{t("integrationBrowserAuto")}</option>
                <option value="vivaldi">Vivaldi</option>
                <option value="chrome">Chrome</option>
                <option value="edge">Edge</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("integrationBrowserProfile")}</Label>
              <Input
                value={state.adfBrowserProfile}
                onChange={(e) => setField("adfBrowserProfile", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("integrationCookieDomain")}</Label>
              <Input
                placeholder={t("integrationCookieDomainPlaceholder")}
                value={state.adfCookieDomain}
                onChange={(e) => setField("adfCookieDomain", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("integrationBrowserUserDataDir")}</Label>
              <Input
                value={state.adfBrowserUserDataDir}
                onChange={(e) => setField("adfBrowserUserDataDir", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const DatabricksFields = ({ state, setField, showSecret, authProfiles }: ProfileProps) => {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t("integrationWorkspaceUrl")}</Label>
        <Input
          value={state.databricksWorkspaceUrl}
          onChange={(e) => setField("databricksWorkspaceUrl", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("integrationHttpPath")}</Label>
        <Input
          value={state.databricksHttpPath}
          onChange={(e) => setField("databricksHttpPath", e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("integrationAuthType")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
          value={state.databricksAuthType}
          onChange={(e) => setField("databricksAuthType", e.target.value as DatabricksAuthType)}
        >
          <option value="pat">{t("integrationAuthBearer")}</option>
          <option value="cookie">{t("integrationAuthCookie")}</option>
          <option value="company-profile">{t("integrationAuthCompanyProfile")}</option>
        </select>
      </div>
      {state.databricksAuthType === "company-profile" && (
        <div className="space-y-2">
          <Label>{t("integrationSelectProfile")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
            value={state.authProfileId}
            onChange={(event) => setField("authProfileId", Number(event.target.value))}
          >
            <option value={0}>{t("integrationSelectProfilePlaceholder")}</option>
            {authProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          {authProfiles.length === 0 && (
            <p className="text-xs text-amber-600">{t("integrationNoProfiles")}</p>
          )}
        </div>
      )}
      {state.databricksAuthType === "pat" && (
        <div className="space-y-2">
          <Label>{t("integrationToken")}</Label>
          <Input
            type={showSecret ? "text" : "password"}
            autoComplete="new-password"
            name="databricks-token"
            value={state.databricksToken}
            onChange={(e) => setField("databricksToken", e.target.value)}
          />
        </div>
      )}
      {state.databricksAuthType === "cookie" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t("integrationCookieHeader")}</Label>
            <Input
              value={state.databricksCookieHeader}
              onChange={(e) => setField("databricksCookieHeader", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("integrationCookieHeaderHint")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("integrationBrowserType")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground dark:bg-slate-950/60 dark:text-slate-100"
                value={state.databricksBrowserType}
                onChange={(e) => setField("databricksBrowserType", e.target.value as BrowserType)}
              >
                <option value="auto">{t("integrationBrowserAuto")}</option>
                <option value="vivaldi">Vivaldi</option>
                <option value="chrome">Chrome</option>
                <option value="edge">Edge</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t("integrationBrowserProfile")}</Label>
              <Input
                value={state.databricksBrowserProfile}
                onChange={(e) => setField("databricksBrowserProfile", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("integrationCookieDomain")}</Label>
              <Input
                placeholder={t("integrationCookieDomainPlaceholder")}
                value={state.databricksCookieDomain}
                onChange={(e) => setField("databricksCookieDomain", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("integrationBrowserUserDataDir")}</Label>
              <Input
                value={state.databricksBrowserUserDataDir}
                onChange={(e) => setField("databricksBrowserUserDataDir", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
