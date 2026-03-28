import { Link, useNavigate } from "react-router-dom";
import { useState, type FormEvent } from "react";
import { getPostLoginDestination, useAuth } from "@/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateBusinessMutation } from "@/services/businessService";
import { cn } from "@/lib/utils";
import { currenctyEnums, subscriptionEnums } from "@packages/enums.ts";
import {
  isValidPassword,
  PASSWORD_POLICY_MESSAGE,
} from "@packages/utils/passwordPolicy.ts";

const selectClassName = cn(
  "flex h-10 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/**
 * Multipart **`POST /api/v1/business`** — required fields match **`backend/src/routes/v1/business.ts`** (Phase 4.2).
 */
export default function BusinessRegisterPage() {
  const navigate = useNavigate();
  const { dispatch } = useAuth();
  const mutation = useCreateBusinessMutation();

  const [tradeName, setTradeName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [subscription, setSubscription] = useState(subscriptionEnums[0] ?? "Free");
  const [currencyTrade, setCurrencyTrade] = useState(currenctyEnums[0] ?? "USD");
  const [contactPerson, setContactPerson] = useState("");

  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [postCode, setPostCode] = useState("");
  const [region, setRegion] = useState("");

  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);

    const tTrade = tradeName.trim();
    const tLegal = legalName.trim();
    const tEmail = email.trim();
    const tPhone = phoneNumber.trim();
    const tTax = taxNumber.trim();
    const tCountry = country.trim();
    const tState = state.trim();
    const tCity = city.trim();
    const tStreet = street.trim();
    const tBuilding = buildingNumber.trim();
    const tPost = postCode.trim();

    if (
      !tTrade ||
      !tLegal ||
      !tEmail ||
      !password ||
      !tPhone ||
      !tTax ||
      !tCountry ||
      !tState ||
      !tCity ||
      !tStreet ||
      !tBuilding ||
      !tPost
    ) {
      setMessage(
        "Trade name, legal name, email, password, phone, tax number, subscription, currency, and full address (country, state, city, street, building number, post code) are required.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Password and confirm password must match.");
      return;
    }

    if (!isValidPassword(password)) {
      setMessage(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (!subscriptionEnums.includes(subscription)) {
      setMessage("Invalid subscription.");
      return;
    }

    if (!currenctyEnums.includes(currencyTrade)) {
      setMessage("Invalid currency.");
      return;
    }

    const address: Record<string, string> = {
      country: tCountry,
      state: tState,
      city: tCity,
      street: tStreet,
      buildingNumber: tBuilding,
      postCode: tPost,
    };
    const r = region.trim();
    if (r) address.region = r;

    const formData = new FormData();
    formData.append("tradeName", tTrade);
    formData.append("legalName", tLegal);
    formData.append("email", tEmail);
    formData.append("password", password);
    formData.append("phoneNumber", tPhone);
    formData.append("taxNumber", tTax);
    formData.append("subscription", subscription);
    formData.append("currencyTrade", currencyTrade);
    formData.append("address", JSON.stringify(address));
    const cp = contactPerson.trim();
    if (cp) formData.append("contactPerson", cp);

    try {
      const result = await mutation.mutateAsync(formData);
      localStorage.setItem("auth_had_session", "1");
      dispatch({ type: "AUTH_SUCCESS", payload: result.user });
      navigate(getPostLoginDestination(result.user), { replace: true });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Registration failed.");
    }
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-neutral-100 px-4 py-8 sm:px-6 lg:px-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Register your business</CardTitle>
          <CardDescription>
            Create a tenant account. Password: at least 8 characters with uppercase, lowercase, a
            number, and a symbol. Fields match the API requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={(e) => void handleSubmit(e)}>
            {message ? <Alert>{message}</Alert> : null}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-900">Business</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="br-trade">Trade name</Label>
                  <Input
                    id="br-trade"
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="br-legal">Legal name</Label>
                  <Input
                    id="br-legal"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-email">Email</Label>
                  <Input
                    id="br-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-phone">Phone number</Label>
                  <Input
                    id="br-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-tax">Tax number</Label>
                  <Input
                    id="br-tax"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-contact">Contact person (optional)</Label>
                  <Input
                    id="br-contact"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-sub">Subscription</Label>
                  <select
                    id="br-sub"
                    className={selectClassName}
                    value={subscription}
                    onChange={(e) => setSubscription(e.target.value)}
                  >
                    {subscriptionEnums.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-currency">Currency</Label>
                  <select
                    id="br-currency"
                    className={selectClassName}
                    value={currencyTrade}
                    onChange={(e) => setCurrencyTrade(e.target.value)}
                  >
                    {currenctyEnums.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-900">Sign-in password</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="br-password">Password</Label>
                  <Input
                    id="br-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-confirm">Confirm password</Label>
                  <Input
                    id="br-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-900">Address</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="br-country">Country</Label>
                  <Input
                    id="br-country"
                    autoComplete="country-name"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-state">State / region</Label>
                  <Input
                    id="br-state"
                    autoComplete="address-level1"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-city">City</Label>
                  <Input
                    id="br-city"
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-street">Street</Label>
                  <Input
                    id="br-street"
                    autoComplete="street-address"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-building">Building number</Label>
                  <Input
                    id="br-building"
                    value={buildingNumber}
                    onChange={(e) => setBuildingNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="br-post">Post code</Label>
                  <Input
                    id="br-post"
                    autoComplete="postal-code"
                    value={postCode}
                    onChange={(e) => setPostCode(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="br-region-extra">Region (optional)</Label>
                  <Input
                    id="br-region-extra"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Optional address.region"
                  />
                </div>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating…" : "Create business"}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/business">Back to business home</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
