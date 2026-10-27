# Venue hardware

> **About this document.** This is the **target-state source of truth** for the hardware a venue must and may provide to run Project Imperium. It is written for business owners and managers deciding what to buy, and for AI agents and engineers who need the hardware boundary in one place. It states what is required, conditional, optional, recommended, and unsupported — without built/planned tags. It is self-contained: it links to no other document.

---

## 1. Scope

This subject covers the physical and connectivity kit a venue needs to:

- create and run a business in Project Imperium;
- go live and take customer orders and bookings;
- print bills, receipts, prep tickets, and kiosk handover tickets;
- run optional prep, delivery, pickup, and kiosk surfaces;
- keep the core service path working through a short power or internet interruption.

It covers each item's purpose, why it is or is not required, the go-live gates, supported and unsupported hardware, failure behaviour, what the business must provide, and a buying checklist.

It deliberately does **not** cover:

- software configuration steps, menu setup, payment-account setup, or plan and billing choices;
- the routing rules that decide which printer receives a ticket, or the content and numbering of bills and receipts;
- network security policy beyond the required separation of the POS network from guest WiFi;
- installation labour, electrical work, or cabling work.

**Sign-up and setup versus go-live.** Creating a business, configuring it, and using the staff surfaces does **not** require the full kit. A draft or offline business is fully usable internally. The hardware kit is a **go-live gate**: it is required before the venue can be **live**, take customer orders and bookings, and print paper. At runtime, a failed print never blocks payment or order taking; the go-live gate still requires a working receipt printer.

---

## 2. Domain model and vocabulary

### Terms this subject introduces

- **Venue PC** — the venue-owned laptop or desktop, running Windows 10/11 or macOS, that hosts the **print connector**. It may also run the POS or back office, must stay at the venue, and must be on whenever the venue can receive orders or print.
- **Print connector** — Project Imperium's background helper that runs on the venue PC. It is **software, not hardware**, and is supplied as part of the service. It pairs to one business, discovers the physical printers the PC can reach, receives print work from the cloud, drives those printers, and reports health.
- **Receipt printer** — a printer used for customer-facing paper: bills, receipts, and kiosk handover tickets. At least one is required for each active payment sales point; one printer may serve several points.
- **Prep printer** — a printer used for kitchen, bar, or other prep tickets. Optional; a control screen or the POS can carry the work instead.
- **Supported router** — a router model on Project Imperium's published compatibility list, configured for the venue's POS network. A router not on the list is not supported.
- **Primary WAN** — the venue's main internet path through the supported router. It must pass the onboarding speed and latency test and is required.
- **POS VLAN** — the dedicated network and WiFi name for the venue PC, printers, screens, and staff devices, kept separate from guest WiFi.
- **Cellular fallback** — the optional cellular path through a SIM in the router, used automatically when the primary WAN is unavailable.
- **UPS** — an uninterruptible power supply that carries the core path through a short power interruption.
- **Cash drawer** — a dumb electromechanical latch wired to a receipt printer's **drawer-kick (DK) port**. It has no network or software identity the cloud can see and holds no balance.
- **DK port** — the drawer-kick port on a receipt printer that pulses the cash drawer open.
- **Control screen** — an in-app prep, delivery, or customer pickup surface opened under a **display lease**. It is not a registered hardware device; any internet browser device can show it.
- **Display lease** — a manager-granted device grant that lets a screen run at a location. It is not a staff session and authenticates no person.
- **Customer pickup board** — a display-only counter screen showing order codes in pending, in progress, and ready columns. It shows no prices, guest names, or payment detail.
- **Kiosk terminal** — an optional self-service terminal running the same web app for kiosk ordering. It is a sales point configured in the product; the physical terminal is optional hardware.
- **Backup printer** — another logical printer, bound to another physical printer, used automatically when a primary printer cannot print.
- **Minimum venue kit** — the hardware required to go live: a venue PC running a paired print connector; at least one receipt printer for each active payment sales point with a successful test print; a supported router on a dedicated POS VLAN with a primary WAN; and a UPS on the core path. Cellular fallback, prep printers, screens, and kiosk terminals are optional.
- **Supported hardware** — hardware that meets the platform, protocol, and connectivity rules in this document. **Unsupported hardware** is hardware outside those rules; it may work informally but the product does not commit to it.

Terms reused rather than redefined here: **Business**, **Sales point**, **User**, **Customer**, **Employee**, **Manager**, **Print permission**, **Drawer kick**, **Money event**, and **Fulfilment status**.

---

## 3. Capabilities

### 3.1 The kit at a glance

| Item | Status | What it does | Why |
| --- | --- | --- | --- |
| **Venue PC** | Required | Hosts the print connector; may also run the POS or back office. | The only bridge from the cloud to ordinary printers. |
| **Print connector** | Required (software) | Pairs the PC to the business, discovers printers, prints, reports health. | Staff devices never reach printers directly. |
| **Receipt printer** | Required; one per active payment sales point, and one printer may serve several points | Prints bills, receipts, and kiosk handover tickets; can support a cash drawer through a DK port. | Paper is the normal receipt path. |
| **Supported router** | Required | Provides WiFi, the POS network, the primary WAN, and optional cellular fallback. | Connects the venue to the cloud and separates POS traffic from guests. |
| **Primary WAN** | Required | The main internet service. | The product is cloud-only. |
| **UPS** | Required | Carries the router, print PC (or laptop battery), counter receipt printer, and any switch. | Keeps the core path alive through short power interruptions. |
| **Cash drawer** | Conditional: cash venues | Opens on recorded money events through the printer's DK port. | Cash handling. |
| **Network switch** | Conditional: wired devices | Adds wired ports. | Only needed when WiFi or router ports are not enough. |
| **Prep printer** | Optional | Prints kitchen, bar, or other prep tickets. | Screens or the POS can carry the work. |
| **Control screen** | Optional | Shows prep, delivery, or pickup work under a display lease. | Any browser device; no dedicated hardware required. |
| **Customer pickup board** | Optional | Shows guest order codes in display mode. | Guest-facing convenience. |
| **Kiosk terminal** | Optional | Self-service ordering terminal. | Adds a kiosk sales channel. |
| **Backup printer** | Optional | Another printer used when the primary fails. | Extra print resilience. |
| **5G SIM** | Optional, recommended | Cellular failover behind the primary WAN. | Keeps service running when broadband drops. |
| **Touchscreen** | Optional, recommended at the pass | Touch gestures on control screens. | Mouse or trackpad also works. |
| **Card reader** | Not required by Project Imperium | Records dine-in card payments on your existing reader. | Self-service kiosk payment is digital; no venue reader. |
| **Traditional register or POS terminal** | Not required | — | The app is the POS. |
| **On-premises server** | Not required | — | The product is cloud-only. |
| **Static IP or inbound ports** | Not required | — | The connector connects outbound only. |
| **Proprietary or brand-locked hardware** | Not required | — | No brand lock beyond the supported lists and protocols. |

### 3.2 Required hardware

#### 3.2.1 Venue PC

- **What it is.** A laptop or desktop the venue owns, running **Windows 10/11 or macOS**. It is an ordinary computer, not a proprietary terminal. A tablet or phone cannot host the connector.
- **What it does.** It hosts the **print connector**, which is the only path from the cloud to ordinary venue printers. The PC may also run the POS or back office. It must stay at the venue and be on whenever the venue can receive orders or print.
- **Why it is required.** Staff phones, tablets, and screens talk only to Project Imperium in the cloud. They do not discover, open, or drive venue printers. Without a venue PC running the connector, the venue cannot print bills, receipts, prep tickets, or kiosk handover tickets.
- **What to buy.** Project Imperium publishes **no specific CPU, memory, or storage specification**; choose a machine that comfortably runs your POS or back-office work and the connector, and that can stay on during service. ChromeOS and Linux are **not supported** hosts. One venue may run more than one PC and connector; there is no hard product limit. One PC can drive several network printers. A USB printer is served by the PC it is plugged into, so place the PC and printer together. A second PC is useful for a distant USB printer or redundancy but is **not required**.
- **What the business must do.** Keep the PC at the venue; keep it on whenever the venue can receive orders or print; disable sleep; schedule OS updates outside service; run the connector under a dedicated non-administrator computer account; apply the antivirus exclusion guide; and support the PC's hardware and operating system. Project Imperium supports the connector only.
- **What it does not do.** The connector never reboots the venue PC, exposes no local API or web page after pairing, and does not offer remote desktop.

#### 3.2.2 Print connector

- **What it is.** Project Imperium's free background helper, installed on the venue PC. It is **software**; the venue does not buy it as hardware. It is a system service, **not a staff session**.
- **What it does.** A manager pairs it to one business. It discovers the physical printers the PC can reach over USB or the local network, reports them to Project Imperium, receives print work from the cloud, and drives the bound printers. It reports health, printer status, and print-job metadata — never document content. It starts on boot, restarts itself if it crashes or hangs, and takes signed auto-updates.
- **Why it is required.** It is the only bridge from the cloud product to ordinary printers. A venue that prints needs a paired, online connector.
- **Pairing and lifecycle.** A manager starts pairing in Project Imperium and completes it on the PC, for example with a short code. Pairing is revocable and re-pairing rotates the connector's identity. A lost, replaced, or decommissioned connector is revoked rather than left trusted. Paired connectors appear in Manage with name, version, status, last heartbeat, and active WAN path.
- **Updates and diagnostics.** Signed auto-updates are on by default and rolled out in stages. The cloud refuses print work below a minimum supported version and alerts managers rather than silently accepting a stale connector. The connector uploads health, error logs, printer status, and print-job metadata; it does not upload document content and does not expose the PC to remote desktop.
- **What to buy.** Nothing. You provide a compatible venue PC and install and pair the connector.

#### 3.2.3 Receipt printer

- **What it is.** A printer for customer-facing paper: bills, receipts, and kiosk handover tickets. It connects by **USB** or the **local network** and speaks a standard receipt or label protocol — for example ESC/POS, Star Line Mode, ZPL, ePOS, or raw network/USB.
- **What it does.** It prints the platform's fixed customer-document layout. It may also be used as a **prep printer** at the same time. It is the physical device behind a logical receipt printer, and it is the printer whose **DK port** can open a cash drawer.
- **Why it is required.** Paper is the normal receipt path. Every active payment sales point must have a receipt printer assigned with a successful **test print**. One printer may serve several points, so a single counter printer can cover all of them.
- **What to buy.** A standard-protocol receipt printer with USB or network connectivity. **Network printers are preferred** for different areas; a USB printer must be within reach of the PC that serves it. If you take cash, choose a model with a **DK port**. A second receipt printer or a backup printer is optional. There is no brand requirement within the supported protocols.
- **What is out of scope.** Printers that work only through a vendor-specific operating-system driver, certified fiscal devices, and smart cash recyclers with their own API.
- **Lifecycle.** A logical printer is bound to a physical printer; if hardware fails or moves, staff rebind the same logical printer to another physical printer and routing and permissions stay. You cannot retire the only receipt printer assigned to an active payment sales point until another is assigned. The platform controls receipt layout; there is **no venue layout editor** and no optional marketing footer.

#### 3.2.4 Supported router

- **What it is.** A router model on Project Imperium's published **supported-router list**, bought by the venue and configured from the onboarding guide. Project Imperium sells no routers.
- **What it does.** It provides the venue's WiFi, a dedicated **POS SSID/VLAN** separate from guest WiFi, the **primary WAN**, and — when fitted with a SIM — optional **cellular fallback**. The venue PC, printers, screens, and staff devices use the POS network; guest devices use the separate guest network.
- **Why it is required.** The product is cloud-only, and the POS network keeps venue traffic stable and separate from guest traffic. A router that cannot provide the POS network is not supported; the internet service must pass the primary WAN test.
- **What to buy.** A model on the supported list that supports WiFi, the dedicated POS SSID/VLAN, the primary WAN, and optional 5G. **One router is enough; no spare router is required.** The venue pays for its internet and any SIM data, and owns carrier data-cap alerts. A router that is not on the list is not supported, even if it works informally.

#### 3.2.5 Primary WAN

- **What it is.** The venue's main internet service through the supported router.
- **What it does.** It connects the venue PC, staff devices, screens, and printers to Project Imperium in the cloud.
- **Why it is required.** The product is cloud-only. The primary WAN must pass the onboarding test of **10 Mbps down, 2 Mbps up, and under 100 ms round-trip**. Any primary WAN technology that passes the test is acceptable.
- **What to buy.** A business-grade internet service that passes the test at the venue. **A 5G-only venue is not supported**; the cellular SIM is failover only, never the primary path. You do **not** need a static IP address or inbound ports; the connector connects outbound only.

#### 3.2.6 UPS

- **What it is.** An uninterruptible power supply for the **core path**.
- **What it does.** It carries the **router**, every **print PC** (or a laptop on battery), the **counter receipt printer**, and any **network switch** through a short power interruption, so the venue can keep taking orders and printing.
- **Why it is required.** A short power dip should not take down the network, the print host, or the counter printer. The UPS is a go-live gate for the core path.
- **What to buy.** A UPS with enough outlets and runtime for the listed devices. **No model or runtime is specified** by Project Imperium. A laptop's own battery counts for the PC. Prep-output resilience beyond the core path is the venue's choice; a whole-venue backup is **not required**.

#### 3.2.7 Network switch (conditional)

- **What it is.** A standard Ethernet switch that adds wired ports.
- **Why it is conditional.** A wired connection is allowed but never required; WiFi is enough for the core kit. Add a switch only if you wire more devices than the router's ports provide. If you use one, put it on the **UPS** as part of the core path.
- **What to buy.** A standard switch; no proprietary model is required. A switch by itself is not a go-live gate.

### 3.3 Optional hardware

#### 3.3.1 Prep printers

- **What they are.** Printers that receive kitchen, bar, or other prep tickets, routed by menu category, subcategory, and sales point.
- **Why optional.** A control screen or the POS can carry the same work, and the product does **not** check or warn about prep-output completeness. The business chooses whether a prep area uses a printer, a screen, both, or neither.
- **What to buy.** A standard-protocol printer, preferably on the network for a different area. A receipt printer may also serve as a prep printer, and one printer may receive several categories or areas if you route them there. A backup printer is optional.

#### 3.3.2 Control screens

- **What they are.** In-app prep main and sub-screens, the delivery screen, and the customer pickup board. They run under a manager-granted **display lease**.
- **Why optional.** Screens are not registered hardware devices and always exist as app pages. Any internet browser device can show one. A venue may run delivery with **no screens at all** and advance fulfilment from the POS.
- **What to buy.** Any internet-connected display or tablet with a browser. **Touch is recommended at the pass but not required**; a mouse or trackpad works. No dedicated screen model is required.
- **Lease, not login.** A display lease is a device grant, not a staff session and not a shared login. It survives the manager signing out and ends when a manager closes or revokes it, the manager is deactivated, or the device is unpaired.

#### 3.3.3 Customer pickup board

- **What it is.** A display-only counter screen showing order codes in pending, in progress, and ready columns for self-pickup, kiosk, and on-premises to-go collection.
- **Why optional.** It is a guest-facing convenience. Guests do not log in, and the board shows **no prices, guest names, or payment detail**. Scanning happens on the POS or handover surface, not on the board.
- **What to buy.** Any internet-connected display. No dedicated hardware is required.

#### 3.3.4 Kiosk terminal

- **What it is.** A self-service terminal running the same web app for kiosk ordering. The **kiosk sales point** is configured in the product; the physical terminal is optional hardware.
- **Why optional.** Kiosk is an optional sales channel. If you run one, payment is **digital** through Project Imperium; kiosk never takes cash and never uses a venue card reader. There is no pay-on-premises kiosk mode.
- **What to buy.** Any suitable self-service terminal or tablet that runs the web app. The kiosk's **handover ticket prints on the receipt printer assigned to that kiosk point**; one receipt printer may serve the kiosk and other points. No proprietary kiosk hardware is required.

#### 3.3.5 Backup printer

- **What it is.** Another logical printer, bound to another physical printer, that is used automatically when a primary printer cannot print.
- **Why optional.** It adds print resilience. A logical printer may name **one backup printer**. Screens have no backup device.
- **What to buy.** Another supported printer, which may sit in a different area. If a connector is offline, a backup printer on another working connector can still print. No special backup hardware class exists.

#### 3.3.6 Cellular fallback (5G SIM)

- **What it is.** A SIM in the supported router that provides automatic failover behind the primary WAN. **5G is preferred; 4G LTE is acceptable where 5G is unavailable.**
- **Why optional but recommended.** It keeps service running when the primary WAN drops. It is **not** a primary path: a 5G-only venue is not supported. A venue without a SIM has no fallback.
- **What to buy.** A 5G-capable SIM and a data plan the venue sizes for its own use. The venue pays for the data and owns carrier data-cap alerts. No spare router is required. The failover test is part of onboarding only when a SIM is fitted.
- **Alerts.** The connector reports the active WAN path. Managers are alerted on a transition to fallback and again if fallback is lost, **only for venues with a SIM**. There is no cellular-fallback alert without a SIM.

#### 3.3.7 Touchscreen

- **What it is.** A touch display at a prep or pickup station.
- **Why optional.** Control-screen gestures are single-click and double-click. **Touch is recommended at the pass but not required**; a mouse or trackpad works, so a venue that skips dedicated screens is not blocked.
- **What to buy.** Any touch display with a browser; no product-specific model.

#### 3.3.8 Manufacturer cloud-print printer (optional secondary)

- A printer with a manufacturer cloud-print service can be bound as an **optional secondary physical target** under the same binding model. It does **not** replace the venue PC or the print connector, and it does not change the required kit.

### 3.4 Not required, not supplied, or not supported

| Item | Status | What to know |
| --- | --- | --- |
| **Hardware sales by Project Imperium** | Not supplied | You buy hardware from your own supplier. |
| **Brand lock** | None | No brand is required within the supported platforms, protocols, and router list. |
| **Proprietary POS terminal** | Not required | A browser device is the POS. |
| **Traditional cash register** | Not required | The app records sales; a cash drawer is separate hardware. |
| **On-premises server** | Not required | The product is cloud-only. |
| **Dedicated venue PC** | Not required | The PC may also run the POS or back office. |
| **Dedicated staff device** | Not required | Staff use a personal or venue-provided browser device. |
| **Shared staff login, PIN, or quick-switch** | Not supported | One User per browser session. |
| **Touchscreen** | Not required | Mouse or trackpad works. |
| **Wired network** | Not required | WiFi is allowed; wiring is optional. |
| **Static IP or inbound ports** | Not required | The connector connects outbound only. |
| **Spare router** | Not required | One supported router is enough. |
| **Backup internet** | Not required | A 5G SIM is optional failover. |
| **5G-only internet** | Not supported | A primary WAN is required. |
| **ChromeOS or Linux connector host** | Not supported | The venue PC must run Windows 10/11 or macOS. |
| **Tablet or phone as connector host** | Not supported | A laptop or desktop hosts the connector; a tablet or phone can still be a staff or screen device. |
| **Driver-only printer** | Not supported | The printer must speak a standard protocol. |
| **Certified fiscal device** | Out of scope | Fiscal certification is not part of this platform. |
| **Smart cash recycler** | Out of scope | Only a dumb drawer on a printer's DK port is supported. |
| **Venue receipt layout editor** | Not provided | Customer documents use the fixed platform layout. |
| **Customer card reader for kiosk** | Not required | Kiosk payment is digital; no venue reader is used. |
| **Dine-in card reader** | Not required by Project Imperium | Dine-in card payments are recorded from your existing reader. |
| **Courier hardware** | Not required | Use own delivery or a third-party provider. |
| **Email receipt hardware** | Not required | Email delivery is software. |
| **Customer app hardware** | Not required | Customers use their own devices. |

### 3.5 Supported and unsupported hardware

| Category | Supported | Not supported, not required, or out of scope |
| --- | --- | --- |
| **Venue PC operating system** | Windows 10/11, macOS | ChromeOS, Linux |
| **Venue PC form** | Laptop or desktop | Tablet or phone as the connector host |
| **Printer connection** | USB, local network | Bluetooth as an internet uplink; vendor-driver-only connection |
| **Printer protocols** | ESC/POS, Star Line Mode, ZPL, ePOS, raw network/USB | Printers that only work through a vendor operating-system driver; certified fiscal devices |
| **Router** | Models on the supported-router list with WiFi, POS SSID/VLAN, primary WAN, optional 5G | Routers not on the list; routers without the required POS network |
| **Internet** | Any primary WAN passing 10 Mbps down / 2 Mbps up / under 100 ms | 5G-only service |
| **Cash drawer** | Dumb latch on a receipt printer's DK port | Smart recyclers with their own API; drawer-open sensors |
| **Control screens** | Any internet browser device; touch optional | Screens as registered hardware; screens that reach money or configuration |
| **Kiosk** | Self-service terminal running the web app; digital payment | Venue card reader; cash; pay-on-premises mode |
| **UPS** | Core path: router, PC or laptop battery, counter receipt printer, switch | A product-specified model or runtime; a whole-venue backup is optional, not required |
| **Network switch** | Standard Ethernet switch, only when wired | A switch as a go-live gate by itself |
| **Cellular fallback** | 5G preferred, 4G LTE acceptable | 5G-only operation |
| **Backup printer** | Another standard-protocol printer, one per logical printer | A special backup hardware class |

### 3.6 Go-live hardware gates

A venue cannot go live until the following hardware checks pass.

| Gate | What proves it |
| --- | --- |
| **Venue PC and connector** | A supported PC has the **print connector paired and online**. |
| **Receipt printer** | At least one receipt printer is assigned to **each active payment sales point**, and a **test print** succeeds. Points may share one printer. |
| **Supported router and POS network** | The router is on the supported list, and the **POS SSID/VLAN** is configured separately from guest WiFi. |
| **Primary WAN** | The onboarding test passes **10 Mbps down, 2 Mbps up, under 100 ms**. |
| **UPS** | The router, every print PC (or laptop battery), the counter receipt printer, and any switch are on the UPS. |
| **Cash drawer port** | A venue that records cash has a receipt printer with a **DK port** at the counter or expeditor. |
| **Cellular fallback** | **Not a gate.** A 5G SIM is recommended, not required. |
| **Prep printers and screens** | **Not a gate.** The business chooses its prep mix; the product does not check or warn about prep-output completeness. |
| **A kiosk terminal, pickup board, backup printer, or email receipts** | **Not a gate.** All are optional. |

**Draft and offline use.** A business can be created, configured, and used internally before these gates pass. Only **go-live** — being discoverable and taking customer orders and bookings — requires the kit.

### 3.7 Failure and continuity

- **A failed print never blocks payment.** The customer pays, may leave without a paper receipt, and may receive the receipt by email when an address is provided. Order taking and prep-screen flow continue. The failed print is retried and managers are alerted.
- **There is no paper-pending state and no settlement gate.** A failed print does not stop a sale, a day close, or the money event behind a drawer kick; the kick itself remains best-effort.
- **Retries do not duplicate output.** Print work is queued durably and delivered safely after reconnect.
- **Prep tickets expire quickly** and are dropped with an alert rather than printed stale. **Bills and receipts retry** until the business day's close.
- **Connector offline.** Its bound printers cannot print, it is shown as offline in Manage, and managers are alerted. A backup printer on another working connector may still print. Payment is never blocked.
- **Connector updates.** The cloud refuses print work below a minimum supported version and alerts managers rather than silently accepting a stale connector.
- **Connector revocation.** A revoked connector receives no further print work, and its reported printers stop being bindable. Re-pairing issues a fresh identity.
- **Primary WAN down.** Service is interrupted unless a SIM is fitted and fallback works. Without a SIM there is no fallback. Managers are alerted on fallback transitions only for venues with a SIM.
- **Power interruption.** The UPS carries the router, print PC (or laptop battery), counter receipt printer, and any switch. Prep-output resilience beyond that is the venue's choice.
- **Drawer kick is best-effort.** The money event commits even if the printer is offline, the connector is missing, or no drawer is attached. The product has no drawer-open sensor. Manual open is audited.
- **Hardware alerts.** Connector offline, print failure, and cellular fallback (venues with a SIM only).
- **What the product does not alert on.** There is no separate venue-wide internet-loss alert; a connector that misses its heartbeat is the connector-offline alert. There is no proactive printer-offline detection beyond print failure, no UPS-state alert, and no carrier data-cap alert.

### 3.8 Buying checklist

**Required**

- A **venue PC**: Windows 10/11 or macOS, laptop or desktop, able to stay on during service, with enough USB or network ports for its printers, and on a UPS or its own battery.
- At least one **receipt printer** for each active payment sales point, with a successful test print; one printer may serve several points.
- A **supported router** from the published list, with WiFi, a dedicated POS SSID/VLAN, and the primary WAN.
- A **primary WAN** that passes 10 Mbps down / 2 Mbps up / under 100 ms.
- A **UPS** for the router, print PC (or laptop battery), counter receipt printer, and any switch.
- A **DK-port receipt printer** at the counter or expeditor if the venue records cash.

**Conditional**

- A **network switch** only if you wire more devices than the router's ports provide; put it on the UPS.
- A **cash drawer** compatible with the receipt printer's DK port, for cash venues.

**Optional**

- Prep printers, control screens, a customer pickup board, a kiosk terminal, a backup printer, a 5G SIM, and touch hardware.

**Do not buy**

- A proprietary POS terminal, an on-premises server, a certified fiscal device, a driver-only printer, a smart cash recycler, a 5G-only internet plan, or a spare router. None is required or supported.

**Ask your supplier**

- Does the printer speak ESC/POS, Star Line Mode, ZPL, ePOS, or raw network/USB?
- Does the receipt printer have a DK port if you take cash?
- Is the printer USB or network, and is it reachable from the planned venue PC?
- Is the router on Project Imperium's supported-router list, and does it support a dedicated POS SSID/VLAN and optional 5G?
- Can the internet service pass the 10/2/<100 ms test at the venue?
- Does the UPS have enough outlets and runtime for the core path?

**Consumables and installation**

- The venue supplies printer paper, standard cables, power, and physical space; any mounts or stands are the venue's choice.
- The venue installs and configures the router from the onboarding guide and provides the PC and its operating system.
- Project Imperium supplies the connector software, the supported-router list, the onboarding guide, the platform receipt layout, and connector/print alerts.

---

## 4. Roles and entitlements

### Base access layers

| Layer | Hardware-related powers and duties |
| --- | --- |
| **Owner/admin** | Buys and provides the hardware, internet, SIM data, power, and space; accepts go-live; may do everything a manager can do. |
| **Manager** | Installs and pairs the print connector; creates, binds, rebinds, and retires logical printers; assigns each active payment sales point its receipt printer; sets backup printers and routing; runs the test print; grants and revokes display leases; sets a staff member's closing receipt printer override; monitors connector, print-failure, and cellular-fallback alerts. |
| **Supervisor** | Uses control screens under a display lease; prints and reprints with print permission by layer default; may open a bound cash drawer manually (audited). Does not configure connectors, printers, routing, or hardware. |
| **Employee** | Uses staff devices and control screens their role or capability allows; prints and reprints only with print permission; may open a bound cash drawer manually (audited). Does not configure hardware. |
| **Customer** | Uses their own device or a kiosk; sees the customer pickup board; never configures hardware. |

### Who does what

| Activity | Who |
| --- | --- |
| Buy the venue PC, printers, router, UPS, switch, kiosk, screens, and cash drawer | Owner/admin |
| Buy internet service and SIM data | Owner/admin |
| Provide power, physical space, paper, and cabling | Owner/admin |
| Install and pair the print connector | Manager and above |
| Configure the supported router and POS network from the onboarding guide | Owner/admin or their IT provider |
| Create, bind, rebind, and retire logical printers; set backups and routing | Manager and above |
| Assign receipt printers to active payment sales points; run the test print | Manager and above |
| Grant and revoke display leases | Manager and above |
| Set a staff member's closing receipt printer override | Manager and above |
| Open a bound cash drawer manually | Any on-duty employee; audited |
| Issue or reprint receipts, bills, kiosk tickets, and prep tickets | Users with **print permission** |
| Monitor connector, print-failure, and cellular-fallback alerts | Managers on duty, else all manager-layer users for the business |
| Support the venue PC, printers, router, and other hardware | Venue and its suppliers |
| Support the connector software, supported-router list, and print path | Project Imperium |
