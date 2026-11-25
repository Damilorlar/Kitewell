import { useState, useCallback, useEffect, useRef } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  checkFreighterInstalled,
  connectFreighterWallet,
  buildPaymentEnvelope,
  buildUnsignedEnvelope,
  submitEnvelopeWithFreighter,
  pathPaymentWithFreighter,
  changeOfferPriceWithFreighter,
  changeTrustWithFreighter,
  createClaimableBalanceWithFreighter,
  claimClaimableBalanceWithFreighter,
  clawbackClaimableBalanceWithFreighter,
  clawbackWithFreighter,
  readKitewellState,
  registerBuilderWithFreighter,
  readAdminState,
  proposeAdminWithFreighter,
  acceptAdminWithFreighter,
  setAccountOptionsWithFreighter,
  allowTrustWithFreighter,
  readContractInstanceTtl,
  extendContractTtlWithFreighter,
  readContractTTL,
  extendCodeTTL,
  readKitewellEvents,
  submitFailureResult,
  signChallengeWithFreighter,
  simulateRegisterBuilder,
  listKitewellBuilders,
  readKitewellBuilder,
  createSponsoredAccountDraft,
  sponsorAccountCreationWithFreighter,
} from "./freighter";
import {
  appendBuilderPage,
  isBuilderCountMismatch,
} from "./builderDirectory";
import {
  createFailedSubmitLog,
  downloadFailedSubmitLog,
} from "./failedSubmitLog";
import { copyToClipboardResult } from "./copyToClipboardResult";
import { shortenAddress } from "./addressFormat";
import { generateAddressQrCode } from "./addressQr";
import {
  fundWithFriendbot,
  buildAsset,
  getAccountBalances,
  getAccountDetails,
  getOpenOffers,
  getPendingTransactions,
  getClaimableBalances,
  getOutgoingSponsorships,
  getSponsoredClaimableBalances,
  getAccountTrades,
  isHorizonSlowdownError,
  HORIZON_SLOWDOWN_MESSAGE,
  getLiquidityPool,
  liquidityPoolDeposit,
  liquidityPoolWithdraw,
  getTransactions,
  groupPaymentsByDay,
  explorerAccountUrl,
  explorerTxUrl,
  downloadAccountSnapshot,
  getAccountAuthConfig,
  getIssuedAssetTrustlines,
  accountLedgerStatus,
  IMMUTABLE_CONFIRMATION,
  getTransactionMemos,
  buildPaymentsCsv,
  PAYMENTS_CSV_FILENAME,
} from "./stellar";
import { downloadCsv } from "./csvExport";
import { buildersToCsv } from "./builderCsv";
import {
  clearStoredOrderBookPair,
  parseOrderBookPair,
  readStoredOrderBookPair,
  saveOrderBookPair,
} from "./orderBookPair";
import { poolShareRows } from "./poolShare";
import {
  calculateMinimumBalance,
  formatStroops,
  minimumBalanceInStroops,
  parseXlmToStroops,
  remainsAboveMinimum,
} from "./accountReserve";
import { validatePaymentAmount } from "./validatePaymentAmount";
import { filterTransactionHistory } from "./txHistoryFilter";
import { fetchHealth, fetchNetworkInfo } from "./api";
import {
  describeEndSponsorship,
  endSponsorshipWithFreighter,
  hasEndSponsorshipAction,
} from "./sponsorshipRevoke";
import { decodeEnvelope, formatArgumentValue } from "./envelopeDecoder";
import { formatSimulationFee } from "./simulationFees";
import { mapPaymentMemo } from "./paymentMemo";
import {
  NETWORKS,
  getActiveNetwork,
  getActiveNetworkId,
  getAvailableNetworks,
  isFriendbotAvailable,
  removeCustomNetwork,
  saveCustomNetwork,
  setActiveNetwork,
} from "./network";
import { validateAssetCode } from "./validateAssetCode";
import { fetchPathQuote, formatPathHops } from "./paths";
import { decodeTransactionEnvelope } from "./txInspector";
import TransactionHashLookup from "./TransactionHashLookup";
import SigningPassphraseConfirmation from "./SigningPassphraseConfirmation";
import MultisigCosignPanel from "./MultisigCosignPanel";
import LabAdminPanel from "./LabAdminPanel";
import { completeWebAuthChallenge } from "./sep10WebAuth";
import { loadIssuerCurrencyList } from "./issuerToml";
import { createPaymentStreamController } from "./paymentStream";
import {
  normaliseTxHash,
  txStatusPresentation,
  watchTransactionStatus,
} from "./txStatusWatch";
import { buildTransactionExplorerUrl } from "./explorerLink";
import {
  canCallContract,
  contractStatusLabel,
  resolveContractStatus,
  rpcCallBlockReason,
} from "./contractStatus";
import "./App.css";

const TABS = [
  "Wallet",
  "Fund",
  "Assets",
  "Send",
  "Path",
  "Order",
  "History",
  "Trades",
  "Inspect",
  "Decode",
  "Issuer",
  "Web auth",
  "Offers",
  "Lab",
  "Liquidity",
];
const PENDING_REFRESH_MS = 8000;
const EVENT_POLL_MS = 6000;
const HIDE_ZERO_ASSETS_STORAGE_KEY = "kitewell.hideZeroCreditAssets";

function readHideZeroAssetsPreference() {
  try {
    return globalThis.localStorage?.getItem(HIDE_ZERO_ASSETS_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
const PATH_MODE_FIELDS = {
  strictSend: {
    amountLabel: "Amount to send",
    boundLabel: "Minimum received",
    boundHint: "Lowest amount of the destination asset you will accept.",
  },
  strictReceive: {
    amountLabel: "Amount to receive",
    boundLabel: "Maximum to send",
    boundHint: "Most of the send asset you are willing to spend.",
  },
};
const MEMO_FIELDS = {
  text: {
    maxLength: 28,
    placeholder: "Up to 28 UTF-8 bytes",
  },
  id: {
    maxLength: 20,
    pattern: "[0-9]{1,20}",
    placeholder: "Unsigned 64-bit integer",
    inputMode: "numeric",
  },
  hash: {
    maxLength: 64,
    pattern: "[0-9a-fA-F]{64}",
    placeholder: "64 hexadecimal characters",
  },
};

function validatePositivePrice(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) {
    throw new Error(`${label} must be a positive decimal.`);
  }
  const price = Number(text);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return text;
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Wallet");
  const [publicKey, setPublicKey] = useState(null);
  const [networkId, setNetworkId] = useState(getActiveNetworkId());
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);
  const [customNetworkForm, setCustomNetworkForm] = useState({
    name: "",
    horizonUrl: "",
    rpcUrl: "",
    passphrase: "",
  });
  const [freighterInstalled, setFreighterInstalled] = useState(null);
  const [balances, setBalances] = useState([]);
  const [hideZeroCreditAssets, setHideZeroCreditAssets] = useState(
    readHideZeroAssetsPreference
  );
  const [claimableBalances, setClaimableBalances] = useState([]);
  const [liquidityPools, setLiquidityPools] = useState({});
  const [liquidityForm, setLiquidityForm] = useState({
    poolId: "",
    mode: "deposit",
    maxAmountA: "",
    maxAmountB: "",
    minPrice: "",
    maxPrice: "",
    amount: "",
    minAmountA: "",
    minAmountB: "",
  });
  const [transactions, setTransactions] = useState([]);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [tradesNextCursor, setTradesNextCursor] = useState(null);
  const [pendingError, setPendingError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [pageCursors, setPageCursors] = useState([null]);
  const [historyFilters, setHistoryFilters] = useState({
    asset: "",
    direction: "",
  });
  const [historyError, setHistoryError] = useState(null);
  const [loading, setLoading] = useState("");
  const [toast, setToast] = useState(null);
  const [transactionFailure, setTransactionFailure] = useState(null);
  const [sendForm, setSendForm] = useState({
    destination: "",
    amount: "",
    assetKey: "native",
    memoType: "text",
    memo: "",
    minTime: "",
    maxTime: "",
  });
  const [sendPrepared, setSendPrepared] = useState(null);

  const updateSendForm = (changes) => {
    setSendForm((previous) => ({
      ...previous,
      ...changes,
    }));
    setSendPrepared(null);
    // Any edit changes the operation list, so the previewed envelope is stale.
    setUnsignedEnvelope(null);
    setSigningConfirmationOpen(false);
  };
  const [trustForm, setTrustForm] = useState({ code: "", issuer: "", limit: "1000000" });
  const [createAccountForm, setCreateAccountForm] = useState({
    destination: "",
    startingBalance: "",
  });
  const [baseReserveInStroops, setBaseReserveInStroops] = useState(null);
  const [reserveError, setReserveError] = useState(null);
  const [reserveSubentryCount, setReserveSubentryCount] = useState("0");
  const [pathForm, setPathForm] = useState({
    mode: "strictSend",
    destination: "",
    amount: "",
    bound: "",
    sendAssetType: "native",
    sendCode: "",
    sendIssuer: "",
    destAssetType: "native",
    destCode: "",
    destIssuer: "",
    path: "",
  });
  const [offerForm, setOfferForm] = useState({
    sellingAssetKey: "native",
    buyingAssetKey: "",
    priceNumerator: "1",
    priceDenominator: "1",
    amount: "",
  });
  const [offerList, setOfferList] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [pathResult, setPathResult] = useState(null);
  const [pathQuote, setPathQuote] = useState(null);
  const [unsignedEnvelope, setUnsignedEnvelope] = useState(null);
  const [signingConfirmationOpen, setSigningConfirmationOpen] = useState(false);
  const [labInfo, setLabInfo] = useState(null);
  const [labError, setLabError] = useState(null);
  const [simulationFees, setSimulationFees] = useState(null);
  const [simulatedRegisterKey, setSimulatedRegisterKey] = useState(null);
  const [labState, setLabState] = useState(null);
  const [labStateError, setLabStateError] = useState(null);
  const [outgoingSponsorships, setOutgoingSponsorships] = useState(null);
  const [sponsorshipsError, setSponsorshipsError] = useState(null);
  const [builderAddress, setBuilderAddress] = useState("");
  const [builderLookupResult, setBuilderLookupResult] = useState(null);
  const [builderLookupError, setBuilderLookupError] = useState(null);
  const [adminState, setAdminState] = useState(null);
  const [proposeAdminForm, setProposeAdminForm] = useState({ address: "" });
  const [registerForm, setRegisterForm] = useState({ name: "" });
  const [lastRegisterTx, setLastRegisterTx] = useState(null);
  const [renameForm, setRenameForm] = useState({ name: "" });
  const [inspectForm, setInspectForm] = useState({ xdr: "" });
  const [inspectResult, setInspectResult] = useState(null);
  const [inspectError, setInspectError] = useState(null);
  const [sessionContractId, setSessionContractId] = useState(null);
  const [deployedContracts, setDeployedContracts] = useState([]);
  const [wasmFile, setWasmFile] = useState(null);
  const [confirmRedeploy, setConfirmRedeploy] = useState(false);
  const [deployError, setDeployError] = useState(null);
  const tabRefs = useRef([]);
  const horizonAbortRef = useRef(null);
  const [accountDetails, setAccountDetails] = useState(null);
  const [clawbackAssets, setClawbackAssets] = useState([]);
  const [clawbackForm, setClawbackForm] = useState({
    assetKey: "",
    holder: "",
    amount: "",
  });
  const [claimableForm, setClaimableForm] = useState({
    claimant: "",
    amount: "",
    assetKey: "native",
    predicateMode: "unconditional",
    ledgerTime: "",
  });
  const [claimableResult, setClaimableResult] = useState(null);
  const [failedSubmits, setFailedSubmits] = useState([]);
  const failedSubmitLogRef = useRef(createFailedSubmitLog());
  const [webAuthForm, setWebAuthForm] = useState({ endpoint: "", serverAccount: "" });
  const [webAuthResult, setWebAuthResult] = useState(null);
  const [webAuthError, setWebAuthError] = useState(null);
  const [issuerInput, setIssuerInput] = useState("");
  const [issuerResult, setIssuerResult] = useState(null);
  const [issuerError, setIssuerError] = useState(null);
  const [streamedPayments, setStreamedPayments] = useState([]);
  const [streamState, setStreamState] = useState(null);
  const [txWatch, setTxWatch] = useState(null);
  const [txWatchError, setTxWatchError] = useState(null);
  const [hashForm, setHashForm] = useState("");
  const [hashError, setHashError] = useState(null);
  const streamSessionRef = useRef(null);
  const watchTokenRef = useRef(0);

  // Issue #512: the controller owns the streamed payments and their paging
  // tokens, so a duplicate event can never reach the list twice; this only
  // mirrors its state into React.
  const paymentStream = useMemo(
    () =>
      createPaymentStreamController({
        onChange: (records, state) => {
          setStreamedPayments(records);
          setStreamState(state);
        },
      }),
    []
  );

  // Issuer auth flags + trustlines the connected account issued.
  const [issuerConfig, setIssuerConfig] = useState(null);
  const [issuerConfigError, setIssuerConfigError] = useState(null);
  const [issuerForm, setIssuerForm] = useState({
    homeDomain: "",
    authRequired: false,
    authRevocable: false,
    authImmutable: false,
    confirmation: "",
  });
  const [issuedTrustlines, setIssuedTrustlines] = useState([]);
  const [issuedTrustlinesError, setIssuedTrustlinesError] = useState(null);

  // Contract instance TTL + event tail in the Lab tab.
  const [ttlInfo, setTtlInfo] = useState(null);
  const [ttlError, setTtlError] = useState(null);
  const [ttlForm, setTtlForm] = useState({ extendTo: "" });
  const [ttlResult, setTtlResult] = useState(null);
  const [labEvents, setLabEvents] = useState([]);
  const [labEventsError, setLabEventsError] = useState(null);
  const eventCursorRef = useRef(null);
  const eventStartLedgerRef = useRef(null);

  // Replay read: one shot from a chosen ledger, separate from the live tail.
  const [replayForm, setReplayForm] = useState("");
  const [replayEvents, setReplayEvents] = useState([]);
  const [replayError, setReplayError] = useState(null);

  // Paged list of registered builders (contract index).
  const [builderList, setBuilderList] = useState(null);
  const [builderListError, setBuilderListError] = useState(null);

  // Sponsored account creation: draft XDR for the new account to co-sign.
  const [sponsorForm, setSponsorForm] = useState({
    newAccount: "",
    coSignedXdr: "",
  });
  const [sponsorDraft, setSponsorDraft] = useState(null);
  const [sponsorResult, setSponsorResult] = useState(null);

  // Issue #668: ending one sponsorship from the list.
  const [endSponsorForm, setEndSponsorForm] = useState({
    sponsoredAccount: "",
    assetCode: "",
    assetIssuer: "",
  });
  const [endSponsorConfirmation, setEndSponsorConfirmation] = useState(null);
  const [endSponsorResult, setEndSponsorResult] = useState(null);

  // One offer watch at a time; aborting the controller only stops polling.
  const [offerWatchId, setOfferWatchId] = useState("");
  const [offerWatch, setOfferWatch] = useState(null);
  const [offerWatchError, setOfferWatchError] = useState(null);
  const offerWatchRef = useRef(null);
  const offerWatchTokenRef = useRef(0);

  const showToast = (message, type = "success", explorerUrl = null) => {
    setToast({ message, type, explorerUrl });
    setTimeout(() => setToast(null), 4200);
  };

  const beginHorizonRead = () => {
    horizonAbortRef.current?.abort();
    const controller = new AbortController();
    horizonAbortRef.current = controller;
    return controller.signal;
  };

  const cancelHorizonReads = () => {
    horizonAbortRef.current?.abort();
    horizonAbortRef.current = null;
  };

  /** Append a failed submit to the in-memory session list (not localStorage). */
  const trackFailedSubmit = (operationType, error) => {
    failedSubmitLogRef.current.record({
      operationType,
      network: getActiveNetworkId(),
      result: submitFailureResult(error),
    });
    setFailedSubmits(failedSubmitLogRef.current.list());
  };

  const handleDownloadFailedSubmits = () => {
    if (failedSubmits.length === 0) return;
    downloadFailedSubmitLog(failedSubmitLogRef.current);
  };

  const handleDownloadAccountSnapshot = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoading("snapshot");
    try {
      await downloadAccountSnapshot(publicKey);
      showToast("Account snapshot downloaded.");
    } catch (e) {
      showToast(e.message || "Could not download account snapshot.", "error");
    } finally {
      setLoading("");
    }
  };

  const xlmBalance = balances.find((b) => b.isNative)?.balance ?? null;
  const assetBalances = balances.filter((b) => !b.isPoolShare);
  const visibleAssetBalances = filterVisibleBalances(
    assetBalances,
    hideZeroCreditAssets
  );
  const poolShares = poolShareRows(balances, liquidityPools);
  const memoField = MEMO_FIELDS[sendForm.memoType];
  const activeNetwork = getActiveNetwork();
  const friendbotAvailable = isFriendbotAvailable();
  const pathModeField = PATH_MODE_FIELDS[pathForm.mode];
  const pathSendAsset = {
    isNative: pathForm.sendAssetType === "native",
    code: pathForm.sendCode,
    issuer: pathForm.sendIssuer,
  };
  const pathDestAsset = {
    isNative: pathForm.destAssetType === "native",
    code: pathForm.destCode,
    issuer: pathForm.destIssuer,
  };
  const updatePathForm = (changes) => {
    setPathForm((prev) => ({ ...prev, ...changes }));
    // Editing the request invalidates any quote from the previous form state.
    setPathQuote(null);
  };
  const updateOfferForm = (changes) => setOfferForm((prev) => ({ ...prev, ...changes }));
  const selectedSendAsset = balances.find((b) => b.key === sendForm.assetKey);
  const selectedComposeAsset = balances.find((b) => b.key === composeForm.assetKey);
  const configuredContractId = labInfo?.network?.contract?.kitewell;
  // The Lab must know whether the instance entry is live or archived before it
  // offers an RPC call: an archived instance fails every invocation.
  const contractStatus = resolveContractStatus({
    contractId: configuredContractId,
    state: labState,
    error: labStateError,
  });
  const contractCallBlock = rpcCallBlockReason(contractStatus);
  const parsedBookPair = parseOrderBookPair(bookPair);
  const bookKey = JSON.stringify([networkId, bookPair.selling, bookPair.buying]);
  const currentBookResult = bookResult?.key === bookKey ? bookResult : null;

  useEffect(() => {
    if (activeTab !== "Book") return;
    const pair = parseOrderBookPair(bookPair);
    if (!pair) return;

    let cancelled = false;
    const clearGeneration = bookClearGenerationRef.current;
    getOrderBook(pair.selling, pair.buying)
      .then((result) => {
        if (cancelled || clearGeneration !== bookClearGenerationRef.current) return;
        setBookResult({ key: bookKey, data: result });
        saveOrderBookPair(bookPair);
      })
      .catch((error) => {
        if (cancelled || clearGeneration !== bookClearGenerationRef.current) return;
        setBookResult({ key: bookKey, error: error.message || "Could not load the order book." });
      });
    return () => { cancelled = true; };
  }, [activeTab, bookPair, bookKey]);

  const getOfferAsset = (side) => {
    const type = offerForm[`${side}Type`];
    return buildAsset({
      isNative: type === "native",
      code: offerForm[`${side}Code`],
      issuer: offerForm[`${side}Issuer`],
    });
  };

  useEffect(() => {
    checkFreighterInstalled().then(setFreighterInstalled);
  }, []);

  useEffect(() => () => cancelHorizonReads(), []);

  // Outgoing sponsorships are a read-only Horizon view. Reload them when the
  // connected account or the selected network changes.
  useEffect(() => {
    if (!publicKey) {
      setOutgoingSponsorships([]);
      setSponsorshipsError(null);
      return undefined;
    }

    let cancelled = false;
    setOutgoingSponsorships(null);
    setSponsorshipsError(null);
    getOutgoingSponsorships(publicKey)
      .then((rows) => {
        if (!cancelled) setOutgoingSponsorships(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setOutgoingSponsorships([]);
        setSponsorshipsError(
          err.message || "Could not read sponsorships from Horizon."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [publicKey, networkId]);

  useEffect(() => {
    if (activeTab !== "Offers" || !publicKey) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setOfferLoading(true);
        setOfferError(null);
        return getOpenOffers(publicKey);
      })
      .then((offers) => {
        if (!cancelled && offers) setOpenOffers(offers);
      })
      .catch((error) => {
        if (!cancelled) {
          setOpenOffers([]);
          setOfferError(error.message || "Could not load open offers.");
        }
      })
      .finally(() => {
        if (!cancelled) setOfferLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeTab, publicKey, networkId, offerRefresh]);

  // A pool-share balance only says how many shares the account holds. Load
  // each pool so the panel can also show both reserves and the total shares.
  useEffect(() => {
    const poolIds = [
      ...new Set(
        balances.filter((b) => b.isPoolShare && b.poolId).map((b) => b.poolId)
      ),
    ];

    if (poolIds.length === 0) return;

    let cancelled = false;
    for (const poolId of poolIds) {
      getLiquidityPool(poolId)
        .then((pool) => {
          if (!cancelled) {
            setLiquidityPools((previous) => ({ ...previous, [poolId]: pool }));
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLiquidityPools((previous) => ({ ...previous, [poolId]: null }));
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [balances]);

  // Keep signerWeights in sync with signers
  useEffect(() => {
    if (signers.length !== signerWeights.length) {
      // Initialize or trim weights to match signers count
      const newWeights = signers.map(() => 0);
      setSignerWeights(newWeights);
    }
  }, [signers.length, signerWeights.length]);

  const refreshBalances = useCallback(async () => {
    if (!publicKey) return;
    setLoading("balance");
    const signal = beginHorizonRead();
    try {
      const next = await getAccountBalances(publicKey, { signal });
      setBalances(next);
      setHorizonNotice(null);
      const claimables = await getSponsoredClaimableBalances(publicKey).catch(() => []);
      setClaimableBalances(claimables);
      try {
        const details = await getAccountDetails(publicKey, { signal });
        const latestLedger = await fetchLatestHorizonLedger(
          activeNetwork.horizonUrl
        ).catch(() => null);
        setAccountDetails({
          ...details,
          ledgerStatus: accountLedgerStatus(
            details.lastModifiedLedger,
            latestLedger
          ),
        });
      } catch (detailsError) {
        if (detailsError?.name === "AbortError") return;
        if (isHorizonSlowdownError(detailsError)) {
          setHorizonNotice(HORIZON_SLOWDOWN_MESSAGE);
          showToast(HORIZON_SLOWDOWN_MESSAGE, "info");
        } else {
          setAccountDetails(null);
        }
      }
      await refreshReserve();
    } catch (error) {
      setBalances([]);
      setClaimableBalances([]);
      if (isHorizonSlowdownError(error)) {
        setHorizonNotice(HORIZON_SLOWDOWN_MESSAGE);
        showToast(HORIZON_SLOWDOWN_MESSAGE, "info");
      } else {
        setHorizonNotice(null);
        showToast("Account not found on Testnet yet. Fund it with Friendbot.", "error");
      }
    } finally {
      setLoading("");
    }
  }, [activeNetwork, publicKey]);

  const handleClawbackClaimable = async (balance) => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoading(`clawback-${balance.id}`);
    try {
      await clawbackClaimableBalanceWithFreighter(publicKey, balance.id);
      const next = await getSponsoredClaimableBalances(publicKey).catch(() => []);
      setClaimableBalances(next);
      showToast(`${balance.code} claimable balance clawed back.`);
    } catch (err) {
      trackFailedSubmit("clawbackClaimableBalance", err);
      showToast(err.message || "Clawback failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const refreshAccountDetails = async () => {
    if (!publicKey) return;
    try {
      setAccountDetails(await getAccountDetails(publicKey));
    } catch {
      setAccountDetails(null);
    }
  };

  const handleSetData = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!dataForm.name) return showToast("Data name is required.", "error");

    setLoading("data-set");
    try {
      await manageDataWithFreighter(publicKey, dataForm.name, dataForm.value);
      setDataForm({ name: "", value: "" });
      await refreshAccountDetails();
      showToast("Account data submitted.");
    } catch (err) {
      showToast(err.message || "Could not set account data.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleClearData = async (name) => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoading(`data-clear-${name}`);
    try {
      await manageDataWithFreighter(publicKey, name, null);
      await refreshAccountDetails();
      showToast(`Cleared account data "${name}".`);
    } catch (err) {
      showToast(err.message || `Could not clear "${name}".`, "error");
    } finally {
      setLoading("");
    }
  };

  const handleMergeAccount = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoading("merge");
    try {
      const result = await mergeAccountWithFreighter(
        publicKey,
        mergeForm.destination,
        mergeForm.retypeDestination
      );
      showToast(
        `Account merge submitted · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
      setPublicKey(null);
      setBalances([]);
      setTransactions([]);
      setAccountDetails(null);
      setMergeForm({ destination: "", retypeDestination: "" });
    } catch (err) {
      showToast(err.message || "Account merge failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleClaimableRefresh = useCallback(async () => {
    if (!publicKey) return;
    setLoading("claimable-list");
    try {
      setClaimableBalances(await getSponsoredClaimableBalances(publicKey));
    } catch (err) {
      setClaimableBalances([]);
      showToast(err.message || "Could not load claimable balances.", "error");
    } finally {
      setLoading("");
    }
  }, [publicKey]);

  const handleCreateClaimable = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!claimableForm.claimant) {
      return showToast("Claimant is required.", "error");
    }
    const selected = balances.find((b) => b.key === claimableForm.assetKey);
    if (!selected) return showToast("Choose an asset you hold.", "error");
    if (parseFloat(claimableForm.amount) > parseFloat(selected.balance)) {
      return showToast(
        `Insufficient ${selected.code} balance. Available: ${selected.balance}.`,
        "error"
      );
    }
    setLoading("claimable-create");
    setClaimableResult(null);
    try {
      const asset = selected.isNative
        ? { isNative: true }
        : { isNative: false, code: selected.code, issuer: selected.issuer };
      const result = await createClaimableBalanceWithFreighter({
        publicKey,
        claimant: claimableForm.claimant,
        amount: claimableForm.amount,
        asset,
        predicateMode: claimableForm.predicateMode,
        ledgerTime: claimableForm.ledgerTime,
      });
      setClaimableResult({ type: "created", hash: result.hash });
      setClaimableForm({
        claimant: "",
        amount: "",
        assetKey: "native",
        predicateMode: "unconditional",
        ledgerTime: "",
      });
      try {
        setBalances(await getAccountBalances(publicKey));
      } catch {
        /* balances refresh separately */
      }
      showToast(
        `Claimable balance created · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
    } catch (err) {
      showToast(err.message || "Could not create claimable balance.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleClaimClaimable = async (balance) => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoading(`claimable-${balance.id}`);
    try {
      const result = await claimClaimableBalanceWithFreighter(publicKey, balance.id);
      setClaimableResult({
        type: "claimed",
        hash: result.hash,
        balanceId: balance.id,
      });
      await handleClaimableRefresh();
      try {
        setBalances(await getAccountBalances(publicKey));
      } catch {
        /* balances refresh separately */
      }
      showToast(
        `Claimable balance claimed · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
    } catch (err) {
      showToast(err.message || "Could not claim balance.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleConnect = async () => {
    setLoading("connect");
    try {
      const address = await connectFreighterWallet();
      submitGuardRef.current.reset();
      setPublicKey(address);
      // Generate a scannable QR code for the connected public address.
      setQrCodeDataUrl(await generateAddressQrCode(address));
      setBalances([]);
      setOpenOffers([]);
      setOfferPrices({});
      setOfferResult(null);
      setClaimableBalances([]);
      setTransactions([]);
      setNextCursor(null);
      setPageCursors([null]);
      setHistoryError(null);
      setSimulationFees(null);
      setSimulatedRegisterKey(null);
      setPendingTransactions([]);
      setPendingError(null);
      showToast("Freighter connected.");
      try {
        const next = await getAccountBalances(address);
        setBalances(next);
      } catch {
        /* unfunded until Friendbot */
      }
      try {
        setAccountDetails(await getAccountDetails(address));
      } catch {
        setAccountDetails(null);
      }
    } catch (e) {
      showToast(e.message || "Failed to connect Freighter.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleDisconnect = () => {
    failedSubmitLogRef.current.clear();
    setFailedSubmits([]);
    setPublicKey(null);
    setQrCodeDataUrl(null);
    setQrCodeDataUrl(null);
    setBalances([]);
    setOpenOffers([]);
    setOfferPrices({});
    setOfferResult(null);
    setTransactions([]);
    setNextCursor(null);
    setPageCursors([null]);
    setHistoryError(null);
    setSimulationFees(null);
    setSimulatedRegisterKey(null);
    setPendingTransactions([]);
    setPendingError(null);
    setAccountDetails(null);
    setSelectedSigners([]);
    setIssuerConfig(null);
    setIssuedTrustlines([]);
    showToast("Disconnected.");
  };

  const handleNetworkChange = (id) => {
    try {
      cancelHorizonReads();
      // The watched offer id belongs to the old network's book.
      offerWatchRef.current?.controller.abort();
      offerWatchRef.current = null;
      setOfferWatch(null);
      setOfferWatchError(null);
      setHorizonNotice(null);
      const next = setActiveNetwork(id);
      submitGuardRef.current.reset();
      setNetworkId(id);
      setBalances([]);
      setOpenOffers([]);
      setOfferPrices({});
      setOfferResult(null);
      setTransactions([]);
      setNextCursor(null);
      setPageCursors([null]);
      setHistoryError(null);
      setPendingTransactions([]);
      setSimulationFees(null);
      setSimulatedRegisterKey(null);
      setPendingError(null);
      setAccountDetails(null);
      setUnsignedEnvelope(null);
      setSigningConfirmationOpen(false);
      setInspectResult(null);
      setInspectError(null);
      setBaseReserveInStroops(null);
      setReserveError(null);
      setReserveSubentryCount("0");
      showToast(`Switched to ${next.label}. Refresh to load balances.`, "info");
      if (publicKey) refreshBalances();
      else if (activeTab === "Assets") refreshReserve();
    } catch (e) {
      showToast(e.message || "Could not switch network.", "error");
    }
  };

  const handleSaveCustomNetwork = (event) => {
    event.preventDefault();
    try {
      const network = saveCustomNetwork(customNetworkForm);
      handleNetworkChange(network.id);
      showToast(`Saved and selected ${network.label}.`, "info");
    } catch (error) {
      showToast(error.message || "Could not save custom network.", "error");
    }
  };

  const handleRemoveCustomNetwork = () => {
    const network = removeCustomNetwork();
    setNetworkId(network.id);
    setCustomNetworkForm({ name: "", horizonUrl: "", rpcUrl: "", passphrase: "" });
    showToast("Custom network removed. Switched to Testnet.", "info");
  };

  const loadTrades = async (cursor) => {
    const page = await getAccountTrades(publicKey, cursor ? { cursor } : {});
    setTrades((previous) => (cursor ? [...previous, ...page.records] : page.records));
    setTradesNextCursor(page.nextCursor);
  };

  const handleTrades = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoading("trades");
    try {
      await loadTrades();
    } catch (err) {
      setTrades([]);
      setTradesNextCursor(null);
      showToast(err.message || "Could not load trades.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleLoadMoreTrades = async () => {
    if (!publicKey || !tradesNextCursor) return;
    setLoading("trades-more");
    try {
      await loadTrades(tradesNextCursor);
    } catch (err) {
      showToast(err.message || "Could not load more trades.", "error");
    } finally {
      setLoading("");
    }
  };

  const refreshPending = useCallback(async () => {
    if (!publicKey) {
      setPendingTransactions([]);
      setPendingError(null);
      return;
    }
    try {
      const rows = await getPendingTransactions(publicKey);
      setPendingTransactions(rows);
      setPendingError(null);
      setHorizonNotice(null);
    } catch (e) {
      if (isHorizonSlowdownError(e)) {
        setHorizonNotice(HORIZON_SLOWDOWN_MESSAGE);
        setPendingError(null);
        return;
      }
      setPendingError(e.message || "Could not load pending transactions.");
    }
  }, [publicKey]);

  useEffect(() => {
    if (activeTab !== "Pending" || !publicKey) {
      return undefined;
    }

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refreshPending();
    };

    tick();
    const timer = setInterval(tick, PENDING_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeTab, publicKey, networkId, refreshPending]);

  const handleFund = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoading("fund");
    try {
      await fundWithFriendbot(publicKey);
      const next = await getAccountBalances(publicKey);
      setBalances(next);
      showToast("Funded with Testnet XLM via Friendbot.");
    } catch (e) {
      showToast(e.message || "Funding failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoading("create-account");
    setCreateAccountResult(null);
    try {
      const result = await createAccountWithFreighter(
        publicKey,
        createAccountForm.destination,
        createAccountForm.startingBalance
      );
      setCreateAccountResult({
        destination: createAccountForm.destination,
        hash: result.hash,
      });
      await refreshBalances();
      showToast(
        `Account created · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
    } catch (err) {
      showToast(err.message || "Create account failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleTrust = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!trustForm.issuer) {
      return showToast("Issuer is required.", "error");
    }
    let code;
    try {
      code = validateAssetCode(trustForm.code);
    } catch (err) {
      setTransactionFailure(null);
      return showToast(err.message, "error");
    }
    setTransactionFailure(null);
    setLoading("trust");
    try {
      const result = await changeTrustWithFreighter(
        publicKey,
        code,
        trustForm.issuer,
        limit
      );
      trackSubmission(result.hash, "changeTrust");
      const next = await getAccountBalances(publicKey);
      setBalances(next);
      setTrustForm({ code: "", issuer: "", limit: "1000000" });
      showToast(`Trustline for ${code} submitted.`);
      startTxWatch(result.hash);
    } catch (err) {
      trackFailedSubmit("changeTrust", err);
      setTransactionFailure(err.transactionFailure ?? null);
      showToast(err.message || "Change trust failed.", "error");
    } finally {
      submitGuardRef.current.end("trust");
      setLoading("");
    }
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");

    let code;
    let amount;
    try {
      code = validateAssetCode(issueForm.code);
      amount = validatePaymentAmount(issueForm.amount, "Issuance amount");
    } catch (err) {
      return showToast(err.message, "error");
    }

    if (!issueForm.destination.trim()) {
      return showToast("Holder account is required.", "error");
    }

    setLoading("issue");
    try {
      const result = await sendPaymentWithFreighter(
        publicKey,
        issueForm.destination.trim(),
        amount,
        { isNative: false, code, issuer: publicKey }
      );
      setIssueForm({ code: "", destination: "", amount: "" });
      showToast(
        `Issued ${amount} ${code} · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
      startTxWatch(result.hash);
    } catch (err) {
      trackFailedSubmit("issue", err);
      showToast(err.message || "Issue failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleChangeLimit = async (asset) => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");

    const newLimit = limitChangeForm[asset.key];
    if (!newLimit || newLimit.trim() === "") {
      return showToast("Enter a new limit.", "error");
    }

    const limitNum = parseFloat(newLimit);
    if (Number.isNaN(limitNum) || limitNum < 0) {
      return showToast("Limit must be a non-negative number.", "error");
    }

    const balance = parseFloat(asset.balance);
    if (limitNum < balance) {
      return showToast(
        `Limit (${newLimit}) cannot be below current balance (${asset.balance}).`,
        "error"
      );
    }

    setLoading(`limit-${asset.key}`);
    try {
      const result = await changeTrustWithFreighter(
        publicKey,
        asset.code,
        asset.issuer,
        newLimit
      );
      const next = await getAccountBalances(publicKey);
      setBalances(next);
      setLimitChangeForm({ ...limitChangeForm, [asset.key]: "" });
      showToast(`${asset.code} trustline limit updated to ${newLimit}.`);
      startTxWatch(result.hash);
    } catch (err) {
      trackFailedSubmit("changeTrust", err);
      showToast(err.message || `Could not change ${asset.code} trustline limit.`, "error");
    } finally {
      setLoading("");
    }
  };

  const handleRemoveTrust = async (asset) => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (parseFloat(asset.balance) > 0) {
      return showToast(
        `${asset.code} still holds a balance. Move it to 0 before removing the trustline.`,
        "error"
      );
    }

    setTransactionFailure(null);
    setLoading(`remove-${asset.key}`);
    try {
      const result = await changeTrustWithFreighter(publicKey, asset.code, asset.issuer, "0");
      const next = await getAccountBalances(publicKey);
      setBalances(next);
      showToast(`${asset.code} trustline removed.`);
      startTxWatch(result.hash);
    } catch (err) {
      trackFailedSubmit("changeTrust", err);
      setTransactionFailure(err.transactionFailure ?? null);
      showToast(err.message || `Could not remove the ${asset.code} trustline.`, "error");
    } finally {
      submitGuardRef.current.end(guardKey);
      setLoading("");
    }
  };

  /** Validate the send form and return the args shared by preview and send. */
  const sendFormArgs = () => {
    if (!publicKey) {
      showToast("Connect Freighter first.", "error");
      return null;
    }
    if (!sendForm.destination) {
      showToast("Destination is required.", "error");
      return null;
    }
    let amount;
    try {
      amount = validatePaymentAmount(sendForm.amount);
    } catch (err) {
      showToast(err.message, "error");
      return null;
    }
    if (
      sendForm.memoType === "text" &&
      new TextEncoder().encode(sendForm.memo).length > 28
    ) {
      showToast("Text memos must be 28 UTF-8 bytes or fewer.", "error");
      return null;
    }

    const selected = balances.find((b) => b.key === sendForm.assetKey);
    if (!selected) {
      showToast("Choose an asset you hold a trustline for.", "error");
      return null;
    }
    if (!selected.isNative && selected.isAuthorized === false) {
      showToast(
        `${selected.code} is unauthorized by its issuer and cannot be sent.`,
        "error"
      );
      return null;
    }
    const available = parseFloat(selected.available || selected.balance);
    if (parseFloat(amount) > available) {
      showToast(
        `Insufficient ${selected.code} balance. Available: ${available.toFixed(7)} (after reserves and liabilities).`,
        "error"
      );
      return null;
    }

    return {
      destination: sendForm.destination,
      amount,
      asset: selected.isNative
        ? { isNative: true }
        : { isNative: false, code: selected.code, issuer: selected.issuer },
      memoType: sendForm.memoType,
      memo: sendForm.memo,
    };
  };

  const buildSendEnvelope = async () => {
    const args = sendFormArgs();
    if (!args) return null;

    return buildPaymentEnvelope(
      publicKey,
      args.destination,
      args.amount,
      args.asset,
      args.memoType,
      args.memo
    );
  };

  /** Build the unsigned envelope only: never signs and never submits. */
  const handlePreviewEnvelope = async () => {
    setLoading("preview");
    try {
      const xdr = await buildSendEnvelope();
      if (!xdr) return;
      setUnsignedEnvelope(xdr);
      showToast(
        "Unsigned envelope ready. Nothing was signed or submitted.",
        "info"
      );
    } catch (err) {
      showToast(err.message || "Could not build the unsigned envelope.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const args = sendFormArgs();
    if (!args) return;

    // Show the envelope before Freighter opens so it can be copied or handed
    // to another signer. The same XDR is signed on the next click.
    if (!unsignedEnvelope) {
      try {
        const xdr = await buildSendEnvelope();
        if (!xdr) return;
        setUnsignedEnvelope(xdr);
        showToast(
          "Review the unsigned envelope, then click Sign & send to sign this exact XDR.",
          "info"
        );
      } catch (err) {
        showToast(err.message || "Could not build the unsigned envelope.", "error");
      }
      return;
    }

    setSigningConfirmationOpen(true);
  };

  const handleConfirmedSend = async () => {
    if (!unsignedEnvelope || !publicKey) return;
    setSigningConfirmationOpen(false);
    setLoading("send");
    let paymentDestination;
    try {
      paymentDestination = await resolveFederationAddress(sendForm.destination);
    } catch (err) {
      setLoading("");
      return showToast(err.message || "Federation lookup failed.", "error");
    }

    try {
      const prepared = await preparePaymentWithFreighter(
        publicKey,
        paymentDestination,
        amount,
        asset,
        sendForm.memoType,
        sendForm.memo,
        minTime,
        maxTime
      );
      setSendPrepared(prepared);
      showToast("Payment prepared. Confirm in Freighter.");
    } catch (err) {
      showToast(err.message || "Payment preparation failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleConfirmSend = async () => {
    if (!publicKey) {
      return showToast("Connect Freighter first.", "error");
    }

    if (!sendPrepared?.transaction) {
      return showToast("No payment prepared.", "error");
    }

    setLoading("send");

    try {
      const result = await confirmPaymentWithFreighter(
        sendPrepared,
        publicKey
      );

      const next = await getAccountBalances(publicKey);
      setBalances(next);
      setSendPrepared(null);

      setSendForm({
        destination: "",
        amount: "",
        assetKey: "native",
        memoType: "text",
        memo: "",
        minTime: "",
        maxTime: "",
      });

      showToast(
        `Payment submitted · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
      startTxWatch(result.hash);
    } catch (err) {
      // Preserve form values if the user refuses to sign or submission fails.
      showToast(err.message || "Payment failed.", "error");
    } finally {
      submitGuardRef.current.end("send");
      setLoading("");
    }
  };

  const handlePathQuote = async () => {
    if (!pathForm.destination || !pathForm.amount) {
      return showToast("Destination and amount are required for a quote.", "error");
    }
    if (pathForm.sendAssetType === "credit" && (!pathForm.sendCode || !pathForm.sendIssuer)) {
      return showToast("Send asset code and issuer are required.", "error");
    }
    if (pathForm.destAssetType === "credit" && (!pathForm.destCode || !pathForm.destIssuer)) {
      return showToast("Destination asset code and issuer are required.", "error");
    }

    setLoading("pathquote");
    setPathQuote(null);
    try {
      const paths = await fetchPathQuote({
        mode: pathForm.mode,
        sendAsset: pathSendAsset,
        destAsset: pathDestAsset,
        destination: pathForm.destination,
        amount: pathForm.amount,
      });
      setPathQuote({
        paths,
        error: paths.length
          ? null
          : "Horizon found no path for this asset pair and amount.",
      });
    } catch (err) {
      setPathQuote({ paths: [], error: err.message || "Path lookup failed." });
    } finally {
      setLoading("");
    }
  };

  const handleUsePath = (path) => {
    const hops = formatPathHops(path);
    setPathForm((prev) => ({ ...prev, path: hops }));
    showToast(
      hops ? `Path applied: ${hops}` : "Direct path applied.",
      "info"
    );
  };

  const handlePathPayment = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!pathForm.destination || !pathForm.amount || !pathForm.bound) {
      return showToast("Destination, amount, and slippage bound are required.", "error");
    }
    if (pathForm.sendAssetType === "credit" && (!pathForm.sendCode || !pathForm.sendIssuer)) {
      return showToast("Send asset code and issuer are required.", "error");
    }
    if (pathForm.destAssetType === "credit" && (!pathForm.destCode || !pathForm.destIssuer)) {
      return showToast("Destination asset code and issuer are required.", "error");
    }

    const fingerprint = [
      pathForm.mode,
      pathForm.destination,
      pathForm.amount,
      pathForm.bound,
      pathForm.sendAssetType,
      pathForm.sendCode,
      pathForm.sendIssuer,
      pathForm.destAssetType,
      pathForm.destCode,
      pathForm.destIssuer,
      pathForm.path,
    ].join("|");
    const gate = submitGuardRef.current.begin("path", fingerprint);
    if (!gate.allowed) return;
    if (
      gate.duplicate &&
      !confirmDuplicate(
        "You submitted this exact path payment in the last 15 seconds. Submit it again?"
      )
    ) {
      submitGuardRef.current.end("path");
      return;
    }

    setLoading("path");
    setTransactionFailure(null);
    setPathResult(null);
    try {
      const result = await pathPaymentWithFreighter({
        publicKey,
        destination: pathForm.destination,
        mode: pathForm.mode,
        sendAsset: pathSendAsset,
        destAsset: pathDestAsset,
        amount: pathForm.amount,
        destMin: pathForm.mode === "strictSend" ? pathForm.bound : undefined,
        sendMax: pathForm.mode === "strictReceive" ? pathForm.bound : undefined,
        path: pathForm.path,
      });

      trackSubmission(result.hash, "pathPayment");
      setPathResult({
        hash: result.hash,
        explorerUrl: explorerTxUrl(result.hash),
      });
      try {
        const next = await getAccountBalances(publicKey);
        setBalances(next);
      } catch {
        /* balance refresh is best-effort */
      }
      showToast(`Path payment submitted · ${result.hash.slice(0, 12)}…`);
      startTxWatch(result.hash);
    } catch (err) {
      trackFailedSubmit("pathPayment", err);
      setTransactionFailure(err.transactionFailure ?? null);
      showToast(err.message || "Path payment failed.", "error");
    } finally {
      submitGuardRef.current.end("path");
      setLoading("");
    }
  };

  const handleClawback = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");

    const asset = clawbackAssets.find(
      (candidate) => candidate.key === clawbackForm.assetKey
    );
    if (!asset) {
      return showToast(
        "Choose an asset you issue with clawback enabled.",
        "error"
      );
    }
    if (!clawbackForm.holder || !clawbackForm.amount) {
      return showToast("Holder and amount are required.", "error");
    }

    const gate = submitGuardRef.current.begin(
      "clawback",
      `${asset.key}|${clawbackForm.holder}|${clawbackForm.amount}`
    );
    if (!gate.allowed) return;

    setLoading("clawback");
    try {
      const result = await clawbackWithFreighter(
        publicKey,
        clawbackForm.holder,
        asset.code,
        asset.issuer,
        clawbackForm.amount
      );
      trackSubmission(result.hash, "clawback");
      setClawbackForm((previous) => ({
        ...previous,
        holder: "",
        amount: "",
      }));
      showToast(
        `Clawback submitted · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
    } catch (err) {
      showToast(err.message || "Clawback failed.", "error");
    } finally {
      submitGuardRef.current.end("clawback");
      setLoading("");
    }
  };

  const handleSponsor = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!sponsorForm.sponsoredAccount) {
      return showToast("Sponsored account is required.", "error");
    }
    if (!sponsorForm.code || !sponsorForm.issuer) {
      return showToast("Asset code and issuer are required.", "error");
    }

    const gate = submitGuardRef.current.begin(
      "sponsor",
      `${sponsorForm.sponsoredAccount}|${sponsorForm.code}|${sponsorForm.issuer}`
    );
    if (!gate.allowed) return;

    setLoading("sponsor");
    try {
      const result = await sponsorTrustlineWithFreighter({
        publicKey,
        sponsoredAccount: sponsorForm.sponsoredAccount,
        assetCode: sponsorForm.code,
        assetIssuer: sponsorForm.issuer,
      });
      trackSubmission(result.hash, "sponsorTrustline");
      setSponsorForm({ sponsoredAccount: "", code: "", issuer: "" });
      showToast(
        `Sponsored trustline submitted · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
    } catch (err) {
      showToast(err.message || "Sponsored trustline failed.", "error");
    } finally {
      submitGuardRef.current.end("sponsor");
      setLoading("");
    }
  };

  const handleOrderBook = async (e) => {
    e.preventDefault();
    setLoading("order-book");
    setOrderBookError(null);
    setOrderBook(null);
    try {
      const book = await getOrderBook(getOfferAsset("selling"), getOfferAsset("buying"));
      setOrderBook(book);
    } catch (error) {
      setOrderBookError(
        error.message === "Selling and buying assets must be different."
          ? error.message
          : "The order book could not be read. Try again in a moment."
      );
    } finally {
      setLoading("");
    }
  };

  const refreshOfferData = async () => {
    const [nextBalances, nextOffers] = await Promise.all([
      getAccountBalances(publicKey),
      getAccountOffers(publicKey),
    ]);
    setBalances(nextBalances);
    setOfferList(nextOffers);
  };

  const handleListOffers = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setLoadingOffers(true);
    try {
      setOfferList(await getAccountOffers(publicKey));
    } catch (err) {
      showToast(err.message || "Could not load active offers.", "error");
    } finally {
      setLoadingOffers(false);
    }
  };

  const handlePlaceOffer = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");

    const sellingAsset = assetBalances.find(
      (asset) => asset.key === offerForm.sellingAssetKey
    );
    const buyingAsset = assetBalances.find(
      (asset) => asset.key === offerForm.buyingAssetKey
    );
    if (!sellingAsset || !buyingAsset) {
      return showToast("Choose both selling and buying assets.", "error");
    }
    if (sellingAsset.key === buyingAsset.key) {
      return showToast("Selling and buying assets must be different.", "error");
    }

    let amount;
    try {
      amount = validatePaymentAmount(offerForm.amount, "Offer amount");
    } catch (err) {
      return showToast(err.message, "error");
    }

    const available = Number.parseFloat(sellingAsset.available ?? sellingAsset.balance);
    if (!Number.isFinite(available) || available <= 0) {
      return showToast(`You do not hold any available ${sellingAsset.code}.`, "error");
    }
    if (Number(amount) > available) {
      return showToast(
        `Insufficient ${sellingAsset.code} balance. Available: ${available}.`,
        "error"
      );
    }

    const describeAsset = (asset) =>
      asset.isNative
        ? { isNative: true }
        : { isNative: false, code: asset.code, issuer: asset.issuer };

    setLoading("offer-place");
    try {
      const operation = buildManageSellOffer({
        selling: describeAsset(sellingAsset),
        buying: describeAsset(buyingAsset),
        amount,
        priceNumerator: offerForm.priceNumerator,
        priceDenominator: offerForm.priceDenominator,
      });
      const unsignedXdr = await buildUnsignedEnvelope(publicKey, [operation]);
      const result = await submitEnvelopeWithFreighter(unsignedXdr, publicKey);
      setOfferForm((previous) => ({ ...previous, amount: "" }));
      showToast(
        `Offer placed · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
      startTxWatch(result.hash);
      try {
        await refreshOfferData();
      } catch (refreshError) {
        showToast(
          `Offer submitted, but balances and offers could not refresh: ${refreshError.message}`,
          "error",
          explorerTxUrl(result.hash)
        );
      }
    } catch (err) {
      trackFailedSubmit("manageSellOffer", err);
      showToast(err.message || "Could not place offer.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleCancelOffer = async (offer) => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");

    setLoading(`offer-cancel-${offer.offerId}`);
    try {
      const operation = buildManageSellOffer({
        selling: offer.selling,
        buying: offer.buying,
        amount: "0",
        priceNumerator: offer.priceNumerator,
        priceDenominator: offer.priceDenominator,
        offerId: offer.offerId,
      });
      const unsignedXdr = await buildUnsignedEnvelope(publicKey, [operation]);
      const result = await submitEnvelopeWithFreighter(unsignedXdr, publicKey);
      showToast(
        `Offer ${offer.offerId} cancelled · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
      startTxWatch(result.hash);
      try {
        await refreshOfferData();
      } catch (refreshError) {
        showToast(
          `Offer cancelled, but balances and offers could not refresh: ${refreshError.message}`,
          "error",
          explorerTxUrl(result.hash)
        );
      }
    } catch (err) {
      trackFailedSubmit("manageSellOffer", err);
      showToast(err.message || "Could not cancel offer.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleLiquidity = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");

    const poolId = liquidityForm.poolId.trim();
    if (!/^[0-9a-f]{64}$/i.test(poolId)) {
      return showToast("Pool ID must be 64 hexadecimal characters.", "error");
    }

    const operationType =
      liquidityForm.mode === "withdraw"
        ? "liquidityPoolWithdraw"
        : "liquidityPoolDeposit";
    setLoading("liquidity");
    try {
      const pool = await getLiquidityPool(poolId);
      if (!Array.isArray(pool.reserves) || pool.reserves.length !== 2) {
        throw new Error("Horizon did not return both pool reserves.");
      }
      if (pool.reserves[0].asset === pool.reserves[1].asset) {
        throw new Error("A pair of the same asset is not supported.");
      }

      let operation;
      if (liquidityForm.mode === "deposit") {
        const minPrice = validatePositivePrice(
          liquidityForm.minPrice,
          "Minimum price"
        );
        const maxPrice = validatePositivePrice(
          liquidityForm.maxPrice,
          "Maximum price"
        );
        if (Number(minPrice) > Number(maxPrice)) {
          throw new Error("Minimum price cannot exceed maximum price.");
        }

        operation = liquidityPoolDeposit(
          poolId,
          validatePaymentAmount(liquidityForm.maxAmountA, "Maximum amount A"),
          validatePaymentAmount(liquidityForm.maxAmountB, "Maximum amount B"),
          minPrice,
          maxPrice
        );
      } else if (liquidityForm.mode === "withdraw") {
        operation = liquidityPoolWithdraw(
          poolId,
          validatePaymentAmount(liquidityForm.amount, "Share amount"),
          validatePaymentAmount(liquidityForm.minAmountA, "Minimum amount A"),
          validatePaymentAmount(liquidityForm.minAmountB, "Minimum amount B")
        );
      } else {
        throw new Error("Choose deposit or withdraw.");
      }

      const unsignedXdr = await buildUnsignedEnvelope(publicKey, [operation]);
      const result = await submitEnvelopeWithFreighter(unsignedXdr, publicKey);
      showToast(
        `Liquidity ${liquidityForm.mode} submitted · ${result.hash.slice(0, 12)}…`,
        "success",
        explorerTxUrl(result.hash)
      );
      startTxWatch(result.hash);

      try {
        setBalances(await getAccountBalances(publicKey));
      } catch (refreshError) {
        showToast(
          `Transaction submitted, but balances could not refresh: ${refreshError.message}`,
          "error",
          explorerTxUrl(result.hash)
        );
      }
    } catch (err) {
      trackFailedSubmit(operationType, err);
      showToast(err.message || "Liquidity operation failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleHistory = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setHistoryError(null);
    setLoading("history");
    const signal = beginHorizonRead();
    try {
      const page = await getTransactions(publicKey, 15, null, { signal });
      if (signal.aborted) return;
      setTransactions(page.records);
      setNextCursor(page.nextCursor);
      setPageCursors([null]);
      setHorizonNotice(null);
      if (page.records.length === 0) showToast("No payments yet.", "info");
    } catch (error) {
      if (error?.name === "AbortError") return;
      setHistoryError(error.message || "Could not load payment history.");
      if (isHorizonSlowdownError(error)) {
        setHorizonNotice(HORIZON_SLOWDOWN_MESSAGE);
        showToast(HORIZON_SLOWDOWN_MESSAGE, "info");
      } else {
        showToast("Could not load payment history.", "error");
      }
    } finally {
      setLoading("");
    }
  };

  const handleLoadNext = async () => {
    if (!publicKey || !nextCursor) return;
    setHistoryError(null);
    setLoading("history-next");
    const signal = beginHorizonRead();
    try {
      const page = await getTransactions(publicKey, undefined, nextCursor, {
        signal,
      });
      if (signal.aborted) return;
      setTransactions(page.records);
      setPageCursors((previous) => [...previous, nextCursor]);
      setNextCursor(page.nextCursor);
      setHorizonNotice(null);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setHistoryError(error.message || "Could not load older payments.");
      if (isHorizonSlowdownError(error)) {
        setHorizonNotice(HORIZON_SLOWDOWN_MESSAGE);
        showToast(HORIZON_SLOWDOWN_MESSAGE, "info");
      } else {
        showToast("Could not load older payments.", "error");
      }
    } finally {
      setLoading("");
    }
  };

  const handleLoadPrevious = async () => {
    if (!publicKey || pageCursors.length < 2) return;
    const previousCursor = pageCursors[pageCursors.length - 2];
    setHistoryError(null);
    setLoading("history-previous");
    const signal = beginHorizonRead();
    try {
      const page = await getTransactions(publicKey, undefined, previousCursor, {
        signal,
      });
      if (signal.aborted) return;
      setTransactions(page.records);
      setPageCursors((previous) => previous.slice(0, -1));
      setNextCursor(page.nextCursor);
      setHorizonNotice(null);
    } catch (error) {
      if (error?.name === "AbortError") return;
      setHistoryError(error.message || "Could not load newer payments.");
      if (isHorizonSlowdownError(error)) {
        setHorizonNotice(HORIZON_SLOWDOWN_MESSAGE);
        showToast(HORIZON_SLOWDOWN_MESSAGE, "info");
      } else {
        showToast("Could not load newer payments.", "error");
      }
    } finally {
      setLoading("");
    }
  };

  // Issue #513: the same watch that follows a submit also serves a pasted hash,
  // so the hash is validated before it reaches Horizon.
  const handleWatchHash = (e) => {
    e.preventDefault();
    setHashError(null);
    let hash;
    try {
      hash = normaliseTxHash(hashForm);
    } catch (err) {
      return setHashError(err.message || "Enter the 64-character transaction hash.");
    }
    setHashForm("");
    startTxWatch(hash);
  };

  // Issue #510: the panel sends the challenge to Freighter to sign and holds
  // the returned JWT only as long as this render needs it.
  const handleWebAuth = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");

    setLoading("webauth");
    setWebAuthError(null);
    setWebAuthResult(null);
    try {
      const result = await completeWebAuthChallenge({
        endpoint: webAuthForm.endpoint,
        account: publicKey,
        serverAccount: webAuthForm.serverAccount,
        sign: (unsignedXdr) => signChallengeWithFreighter(unsignedXdr, publicKey),
      });
      setWebAuthResult({ requestUrl: result.requestUrl, ...result.challenge, session: result.session });
      showToast("Web authentication complete.");
    } catch (err) {
      setWebAuthError(err.message || "Web authentication failed.");
    } finally {
      setLoading("");
    }
  };

  // Issue #511: an issuer account resolves to its home domain first, so the
  // same form accepts either an account or a domain.
  const handleIssuerLookup = async (e) => {
    e.preventDefault();
    setLoading("issuer");
    setIssuerError(null);
    setIssuerResult(null);
    try {
      setIssuerResult(await loadIssuerCurrencyList({ accountOrDomain: issuerInput }));
    } catch (err) {
      setIssuerError(err.message || "Could not read the issuer's stellar.toml.");
    } finally {
      setLoading("");
    }
  };

  const requireWallet = !publicKey;
  const visibleTransactions = mergeStreamedPayments(streamedPayments, transactions);
  const currentRegisterSimulationKey = JSON.stringify([
    publicKey,
    networkId,
    labInfo?.network?.contract?.kitewell,
    registerForm.name.trim(),
  ]);
  const registerSimulationReady =
    Boolean(simulationFees) &&
    !simulationFees.error &&
    simulatedRegisterKey === currentRegisterSimulationKey;
  const historyAssets = [
    ...new Set(
      visibleTransactions
        .map((tx) => (tx.asset_type === "native" ? "XLM" : tx.asset_code))
        .filter(Boolean)
        .concat(historyFilters.asset ? [historyFilters.asset] : [])
    ),
  ].sort();
  const filteredTransactions = filterTransactionHistory(visibleTransactions, {
    asset: historyFilters.asset || null,
    direction: publicKey ? historyFilters.direction || null : null,
    publicKey,
  });
  const currentHistoryCursor = pageCursors[pageCursors.length - 1];

  const loadLabInfo = async () => {
    setLoading("lab");
    setLabError(null);
    try {
      const [health, network] = await Promise.all([fetchHealth(), fetchNetworkInfo()]);
      setLabInfo({ health, network });
      // Use the freshly fetched id rather than stale state from this render.
      await readLabState(sessionContractId || network.contract?.kitewell);
    } catch (e) {
      setLabInfo(null);
      setLabError(
        e.message ||
          "Backend offline. Start it with: npm run dev:backend"
      );
      return null;
    } finally {
      setLoading("");
    }
  };

  const checkRpc = useCallback(async () => {
    setRpcHealth((prev) => ({ ...prev, description: "checking" }));
    try {
      const result = await checkSorobanRpcHealth();
      setRpcHealth(result);
    } catch (error) {
      setRpcHealth((prev) => ({
        ...prev,
        ok: false,
        description: "unreachable",
        latestLedger: null,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, []);

  // Recheck whenever the user switches networks: the new Horizon/Soroban RPC
  // may be up while the old one is down.
  useEffect(() => {
    checkRpc();
  }, [checkRpc, networkId]);

  const refreshLabState = useCallback(async () => {
    const contractId = labInfo?.network?.contract?.kitewell;
    if (!contractId) {
      setLabState(null);
      setLabStateError(null);
      setAdminState(null);
      return;
    }

    // The Soroban RPC must be reachable before the Lab tab simulates or
    // deploys anything. The backend's Horizon requests are intentionally
    // unaffected: classic payments only need the Horizon server, not the RPC.
    if (!rpcHealth.ok) {
      setLabState(null);
      setAdminState(null);
      setLabStateError(
        rpcHealth.error ||
          `Soroban RPC unreachable (${rpcHealth.description}). ` +
          "Switch networks and refresh to recheck."
      );
      return;
    }

    setLoading("labstate");
    setLabStateError(null);
    setAdminState(null);
    try {
      // Always read builder state
      const state = await readKitewellState(contractId, publicKey);
      setLabState(state);
      
      // Try to read admin state, but don't fail if the contract doesn't have
      // get_pending_admin yet (it's new in this PR and may not be deployed)
      try {
        const admin = await readAdminState(contractId);
        setAdminState(admin);
      } catch {
        // Admin read failed (probably because get_pending_admin doesn't exist
        // on the deployed contract yet), but keep the builder state
        setAdminState(null);
      }
    } catch (e) {
      setLabState(null);
      setLabStateError(
        e.message || "Could not read the kitewell contract via Soroban RPC."
      );
    } finally {
      setLoading("");
    }
  }, [labInfo, publicKey, rpcHealth]);

  const handleBuilderLookup = async (e) => {
    e.preventDefault();
    const contractId = labInfo?.network?.contract?.kitewell;
    setBuilderLookupResult(null);
    setBuilderLookupError(null);
    if (!contractId) {
      setBuilderLookupError(
        "No contract id configured — deploy first (contracts/README.md)."
      );
      return;
    }
    setLoading("builder-lookup");
    try {
      setBuilderLookupResult(
        await readKitewellBuilder(contractId, builderAddress)
      );
    } catch (err) {
      setBuilderLookupError(err.message || "Builder lookup failed.");
    } finally {
      setLoading("");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!rpcHealth.ok) {
      return showToast(
        "Soroban RPC unreachable — the contract cannot be invoked until it recovers.",
        "error"
      );
    }
    const contractId = labInfo?.network?.contract?.kitewell;
    if (!contractId) {
      return showToast(
        "No contract id configured — deploy first (contracts/README.md).",
        "error"
      );
    }
    if (!registerForm.name.trim()) {
      return showToast("Enter a builder name to register.", "error");
    }
    const expectedSimulationKey = JSON.stringify([
      publicKey,
      networkId,
      contractId,
      registerForm.name.trim(),
    ]);
    if (
      simulationFees?.error ||
      simulatedRegisterKey !== expectedSimulationKey
    ) {
      return showToast("Simulate this registration successfully before signing.", "error");
    }
    setLoading("register");
    setTransactionFailure(null);
    try {
      const result = await registerBuilderWithFreighter(
        publicKey,
        contractId,
        registerForm.name,
        labInfo?.network?.passphrase
      );
      trackSubmission(result.hash, "register");
      setLastRegisterTx(result);
      setRegisterForm({ name: "" });
      setSimulationFees(null);
      setSimulatedRegisterKey(null);
      showToast(
        result.confirmed
          ? `Registered on-chain · ${result.hash.slice(0, 12)}…`
          : `Submitted · ${result.hash.slice(0, 12)}…`,
        "success"
      );
      startTxWatch(result.hash);
      const state = await readKitewellState(contractId, publicKey);
      setLabState(state);
    } catch (err) {
      trackFailedSubmit("register", err);
      showToast(err.message || "Contract invoke failed.", "error");
    } finally {
      submitGuardRef.current.end("register");
      setLoading("");
    }
  };

  // Handle signer weight change
  const handleSignerWeightChange = (index, weight) => {
    const newWeights = [...signerWeights];
    newWeights[index] = weight;
    setSignerWeights(newWeights);
  };

  // Handle remove signer
  const handleRemoveSigner = (index) => {
    // Check if removing this signer would lock out the high threshold
    const currentSignerWeight = signerWeights[index] ?? 0;
    const remainingWeight = signerWeights.filter((_, i) => i !== index).reduce((sum, w) => sum + (w ?? 0), 0);
    if (remainingWeight < highThreshold && signers.length > 1) {
      if (!window.confirm(
        `Removing this signer would leave ${remainingWeight} total weight, which is below the high threshold of ${highThreshold}.\n\nAre you sure you want to remove this signer? This may lock you out of high-threshold operations.`
      )) {
        return;
      }
    }
    setSigners(signers.filter((_, i) => i !== index));
    setSignerWeights(signerWeights.filter((_, i) => i !== index));
  };

  // Handle add signer
  const handleAddSigner = (newSignerKey) => {
    if (!newSignerKey) return;
    const trimmed = newSignerKey.trim();
    if (!trimmed) return;
    if (!StellarSdk.StrKey.isValidEd25519PublicKey(trimmed)) {
      return showToast("Invalid signer public key format.", "error");
    }
    // Check if signer already exists
    if (signers.includes(trimmed)) {
      return showToast("This signer is already added.", "error");
    }
    setSigners([...signers, trimmed]);
    setSignerWeights([...signerWeights, 0]);
    showToast("Signer added with weight 0.");
  };

  // Handle setOptions transaction for signer weights and thresholds
  const handleSetOptions = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");

    // Build the setOptions operation with the edited values
    const operations = [];

    // Build the setOptions params
    const setOptionsParams = {
      lowThreshold: lowThreshold,
      medThreshold: medThreshold,
      highThreshold: highThreshold,
      signer: signers.map((signer, index) => ({
        address: signer,
        weight: signerWeights[index] ?? 0,
      })),
    };

    // Build the setOptions transaction
    try {
      setLoading("setoptions");
      const sourceAccount = await getServer().loadAccount(publicKey);
      const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: currentPassphrase(),
      });
      txBuilder.setOptions(setOptionsParams);
      const txXDR = txBuilder.setTimeout(180).build().toXDR();

      // Show the envelope before Freighter opens
      setUnsignedEnvelope(txXDR);
      showToast(
        "Review the unsigned setOptions envelope, then sign in Freighter.",
        "info"
      );
    } catch (err) {
      trackFailedSubmit("setoptions", err);
      showToast(err.message || "Failed to build setOptions transaction.", "error");
    } finally {
      setLoading("");
    }
  };

  const refreshTtlInfo = async (explicitContractId) => {
    const contractId = explicitContractId ?? configuredContractId;
    if (!contractId) {
      setTtlInfo(null);
      setTtlError(null);
      return;
    }
    setLoading("ttl");
    setTtlError(null);
    try {
      const info = await readContractInstanceTtl(contractId);
      setTtlInfo(info);
      setTtlForm({
        extendTo: String((info.liveUntilLedgerSeq || info.latestLedger || 0) + 5000),
      });
    } catch (err) {
      setTtlInfo(null);
      setTtlError(err.message || "Could not read the instance TTL.");
    } finally {
      setLoading("");
    }
  };

  const refreshCodeTtl = useCallback(async () => {
    if (!configuredContractId) {
      setCodeTtl(null);
      setCodeTtlError(null);
      return;
    }
    setLoading("code-ttl");
    setCodeTtlError(null);
    try {
      const ttlData = await readContractTTL(configuredContractId);
      setCodeTtl(ttlData);
    } catch (err) {
      setCodeTtl(null);
      setCodeTtlError(err.message || "Could not read the contract code TTL.");
    } finally {
      setLoading("");
    }
  }, [configuredContractId]);

  const handleExtendCodeTtl = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!configuredContractId) {
      return showToast("No contract id configured.", "error");
    }
    if (!codeTtl?.wasmHash || !codeTtl?.currentLedger) {
      return showToast("Refresh the code TTL first.", "error");
    }

    const extendTo = codeTtl.currentLedger + 100000;
    setLoading("extend-code");
    try {
      const result = await extendCodeTTL(
        publicKey,
        codeTtl.wasmHash,
        extendTo,
        codeTtl.currentLedger
      );
      showToast(`Code TTL extended to ledger ${result.deadline}.`, "success");
      await refreshCodeTtl();
    } catch (err) {
      showToast(err.message || "Failed to extend code TTL.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleExtendTtl = async (e) => {
    e.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!configuredContractId) {
      return showToast("No contract id configured — deploy first.", "error");
    }
    setLoading("ttl-extend");
    try {
      const result = await extendContractTtlWithFreighter(
        publicKey,
        configuredContractId,
        ttlForm.extendTo,
        {
          currentDeadline: ttlInfo?.liveUntilLedgerSeq ?? undefined,
          latestLedger: ttlInfo?.latestLedger ?? undefined,
        }
      );
      setTtlResult({
        hash: result.hash,
        liveUntilLedgerSeq: result.liveUntilLedgerSeq,
      });
      showToast(
        result.confirmed
          ? `TTL extended to ledger ${result.liveUntilLedgerSeq}.`
          : `TTL extension submitted · ${result.hash.slice(0, 12)}…`
      );
      await refreshTtlInfo(configuredContractId);
    } catch (err) {
      showToast(err.message || "Could not extend the instance TTL.", "error");
    } finally {
      setLoading("");
    }
  };

  const pollLabEvents = useCallback(async (contractId) => {
    if (!contractId) return;
    try {
      const result = await readKitewellEvents(contractId, {
        cursor: eventCursorRef.current || undefined,
        startLedger: eventStartLedgerRef.current || undefined,
      });
      if (eventStartLedgerRef.current === null && result.latestLedger) {
        eventStartLedgerRef.current = result.latestLedger;
      }
      if (result.cursor) eventCursorRef.current = result.cursor;
      setLabEvents((previous) => {
        const byId = new Map(previous.map((event) => [event.id, event]));
        result.events.forEach((event) => byId.set(event.id, event));
        return [...byId.values()];
      });
      setLabEventsError(null);
    } catch (err) {
      setLabEventsError(err.message || "Could not read contract events.");
    }
  }, []);

  // Start the tail at the ledger open when the Lab tab is first shown, and
  // poll for new register / pause events while it stays open.
  useEffect(() => {
    if (activeTab !== "Lab" || !configuredContractId) {
      if (activeTab !== "Lab") {
        eventCursorRef.current = null;
        eventStartLedgerRef.current = null;
      }
      return undefined;
    }
    eventCursorRef.current = null;
    eventStartLedgerRef.current = null;
    pollLabEvents(configuredContractId);
    const timer = setInterval(
      () => pollLabEvents(configuredContractId),
      EVENT_POLL_MS
    );
    return () => clearInterval(timer);
  }, [activeTab, configuredContractId, pollLabEvents]);

  // Issue #570: a replay read is one shot from the user's start ledger. It
  // never moves the live tail's cursor or opening ledger.
  const handleReplayEvents = async (event) => {
    event.preventDefault();
    setReplayError(null);
    setReplayEvents([]);

    if (!configuredContractId) {
      setReplayError("No contract id configured — nothing to replay.");
      return;
    }

    setLoading("replay");
    try {
      const result = await readKitewellEvents(configuredContractId, {
        startLedger: Number(replayForm),
        limit: 200,
      });
      setReplayEvents(result.events);
      if (result.events.length === 0) {
        setReplayError("No register or pause events from that ledger yet.");
      }
    } catch (err) {
      setReplayError(err.message || "Could not replay contract events.");
    } finally {
      setLoading("");
    }
  };

  // Issue #643: append fixed-size pages from the contract's builder index.
  const loadBuilderPage = useCallback(
    async (start = 0, explicitContractId, append = false) => {
      const contractId = explicitContractId ?? configuredContractId;
      if (!contractId) {
        setBuilderList(null);
        setBuilderListError(null);
        return;
      }
      setLoading("builders");
      setBuilderListError(null);
      try {
        const page = await listKitewellBuilders(contractId, { start });
        setBuilderList((previous) =>
          appendBuilderPage(previous, { ...page, start }, contractId)
        );
      } catch (err) {
        if (!append) setBuilderList(null);
        setBuilderListError(
          err.message || "Could not read the builder index."
        );
      } finally {
        setLoading("");
      }
    },
    [configuredContractId]
  );

  // Issue #572: the draft is the unsigned three-op envelope that only the new
  // account's owner can co-sign. Nothing is submitted until both signatures
  // are present.
  const handleBuildSponsorDraft = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    setSponsorDraft(null);
    setSponsorResult(null);
    setLoading("sponsor-draft");
    try {
      const draft = await createSponsoredAccountDraft(
        publicKey,
        sponsorForm.newAccount
      );
      setSponsorDraft(draft);
      showToast(
        "Unsigned sponsorship envelope ready. Have the new account sign it, then paste the signed XDR.",
        "info"
      );
    } catch (err) {
      showToast(err.message || "Could not build the sponsorship envelope.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleSponsorAccount = async (event) => {
    event.preventDefault();
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!sponsorForm.coSignedXdr.trim()) {
      return showToast(
        "The new account must co-sign before this is submitted.",
        "error"
      );
    }

    setLoading("sponsor");
    setSponsorResult(null);
    try {
      const result = await sponsorAccountCreationWithFreighter(
        publicKey,
        sponsorForm.newAccount,
        sponsorForm.coSignedXdr.trim()
      );
      setSponsorResult(result);
      setSponsorForm({ newAccount: "", coSignedXdr: "" });
      setSponsorDraft(null);
      showToast(`Sponsored account created · ${result.hash.slice(0, 12)}…`);
      startTxWatch(result.hash);
    } catch (err) {
      trackFailedSubmit("sponsorAccount", err);
      showToast(err.message || "Sponsored account creation failed.", "error");
    } finally {
      setLoading("");
    }
  };

  // Issue #668: the confirmation names the sponsored account and the entry,
  // and only then does Freighter open. Cancelling signs nothing.
  const handleReviewEndSponsorship = (event) => {
    event.preventDefault();
    const row = { entryType: "trustline", ...endSponsorForm };
    const confirmation = describeEndSponsorship(row);
    setEndSponsorResult(null);
    if (!confirmation) {
      setEndSponsorConfirmation(null);
      return showToast(
        "This sponsorship entry cannot be identified, so it cannot be ended.",
        "error"
      );
    }
    setEndSponsorConfirmation({ ...confirmation, row });
  };

  const handleEndSponsorship = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!endSponsorConfirmation) return;

    setLoading("end-sponsorship");
    try {
      const result = await endSponsorshipWithFreighter(
        publicKey,
        endSponsorConfirmation.row
      );
      setEndSponsorResult(result);
      setEndSponsorConfirmation(null);
      setEndSponsorForm({
        sponsoredAccount: "",
        assetCode: "",
        assetIssuer: "",
      });
      showToast(`Sponsorship ended · ${result.hash.slice(0, 12)}…`, "success");
    } catch (err) {
      trackFailedSubmit("endSponsorship", err);
      showToast(err.message || "Ending the sponsorship failed.", "error");
    } finally {
      setLoading("");
    }
  };

  // Issue #541: stopping the watch aborts only the polling loop.
  const stopOfferWatch = useCallback(() => {
    offerWatchRef.current?.controller.abort();
    offerWatchRef.current = null;
  }, []);

  const handleWatchOffer = async (event) => {
    event.preventDefault();
    setOfferWatchError(null);
    stopOfferWatch();

    const offerId = offerWatchId.trim();
    const controller = new AbortController();
    const token = offerWatchTokenRef.current + 1;
    offerWatchTokenRef.current = token;
    offerWatchRef.current = { controller, token };
    setOfferWatch({ offerId, status: "watching" });

    try {
      const result = await watchOfferUntilGone(offerId, {
        publicKey,
        signal: controller.signal,
        onUpdate: (offer) => {
          if (offerWatchTokenRef.current !== token) return;
          setOfferWatch(
            offer
              ? { offerId, status: "open", ...offer }
              : { offerId, status: "watching" }
          );
        },
      });

      if (offerWatchTokenRef.current !== token) return;
      if (result.status === "gone") {
        setOfferWatch({
          offerId,
          status: "gone",
          stillListed: result.stillListed,
        });
      } else {
        setOfferWatch({ offerId, status: "still-open" });
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setOfferWatch({ offerId, status: "stopped" });
        return;
      }
      setOfferWatch(null);
      setOfferWatchError(err.message || "Could not watch this offer.");
    } finally {
      if (offerWatchRef.current?.token === token) {
        offerWatchRef.current = null;
      }
    }
  };

  useEffect(() => () => stopOfferWatch(), [stopOfferWatch]);

  const handleInspect = (event) => {
    event.preventDefault();
    setInspectError(null);
    setInspectResult(null);
    try {
      setInspectResult(
        decodeTransactionEnvelope(inspectForm.xdr, activeNetwork.passphrase)
      );
    } catch (e) {
      setInspectError(e.message || "XDR could not be read.");
    }
  };

  const copyContractId = async (contractId) => {
    const result = await copyToClipboardResult(contractId);
    showToast(
      result.ok ? "Contract id copied." : "Could not copy — select the id manually.",
      result.ok ? "success" : "error"
    );
  };

  const handleDeploy = async () => {
    if (activeNetwork.id !== "TESTNET") {
      return showToast("Contract deploy is Testnet-only.", "error");
    }
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    if (!wasmFile) return showToast("Choose the built kitewell.wasm first.", "error");

    // A second deploy needs an explicit confirmation; the first id stays listed.
    if (sessionContractId && !confirmRedeploy) {
      setConfirmRedeploy(true);
      return;
    }

    setDeployError(null);
    setLoading("deploy");
    try {
      const wasmBytes = await wasmFile.arrayBuffer();
      const result = await deployKitewellContract(publicKey, wasmBytes);
      setSessionContractId(result.contractId);
      setDeployedContracts((previous) => [...previous, result]);
      setConfirmRedeploy(false);
      await readLabState(result.contractId);
      const copied = await copyToClipboardResult(result.contractId);
      showToast(
        copied.ok
          ? `Deployed · ${result.contractId.slice(0, 8)}… copied.`
          : `Deployed · ${result.contractId.slice(0, 8)}…`,
        "success"
      );
    } catch (err) {
      setDeployError({
        message: err.message || "Contract deploy failed.",
        // An init failure still has an installed contract; a failed install does not.
        contractId: err.contractId || null,
      });
      showToast("Contract deploy failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const handleComposeAdd = (event) => {
    event.preventDefault();
    if (composeOps.length >= MAX_COMPOSED_OPERATIONS) {
      return showToast(
        `A transaction can contain at most ${MAX_COMPOSED_OPERATIONS} operations.`,
        "error"
      );
    }

    const entry = { type: composeForm.type };
    if (composeForm.type === "payment") {
      const selected = balances.find((b) => b.key === composeForm.assetKey);
      entry.destination = composeForm.destination.trim();
      entry.amount = composeForm.amount;
      entry.asset =
        selected && !selected.isNative
          ? { isNative: false, code: selected.code, issuer: selected.issuer }
          : { isNative: true };
    } else if (composeForm.type === "changeTrust") {
      entry.code = composeForm.code.trim();
      entry.issuer = composeForm.issuer.trim();
      entry.limit = composeForm.limit;
    } else {
      entry.name = composeForm.name.trim();
      entry.value = composeForm.value;
    }

    try {
      buildComposedOperation(entry);
    } catch (err) {
      return showToast(err.message, "error");
    }

    composeId.current += 1;
    setComposeOps((previous) => [...previous, { ...entry, id: composeId.current }]);
    setComposeForm((previous) => ({
      ...previous,
      destination: "",
      amount: "",
      code: "",
      issuer: "",
      limit: "1000000",
      name: "",
      value: "",
    }));
    setComposeResult(null);
    setComposeError(null);
  };

  const moveComposeOperation = (index, offset) => {
    setComposeOps((previous) => {
      const target = index + offset;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setComposeResult(null);
    setComposeError(null);
  };

  const removeComposeOperation = (index) => {
    setComposeOps((previous) => previous.filter((_, i) => i !== index));
    setComposeResult(null);
    setComposeError(null);
  };

  const handleComposeSubmit = async () => {
    if (composeOps.length === 0) {
      setComposeError("Add at least one operation before signing.");
      return;
    }
    if (!publicKey) {
      return showToast("Connect Freighter first.", "error");
    }

    setLoading("compose");
    setComposeError(null);
    setComposeResult(null);
    try {
      const result = await submitComposedOperations(publicKey, composeOps);
      setComposeResult({
        hash: result.hash,
        explorerUrl: explorerTxUrl(result.hash),
      });
      setComposeOps([]);
      showToast(`Composed transaction submitted · ${result.hash.slice(0, 12)}…`);
      try {
        const next = await getAccountBalances(publicKey);
        setBalances(next);
      } catch {
        /* balance refresh is best-effort */
      }
    } catch (err) {
      setComposeError(err.message || "Composed transaction failed.");
      showToast(err.message || "Composed transaction failed.", "error");
    } finally {
      setLoading("");
    }
  };

  const loadFeeStats = async () => {
    setLoading("feestats");
    setFeeStatsError(null);
    setFeeStats(null);
    try {
      setFeeStats(await getFeeStats());
    } catch {
      setFeeStatsError("Fee stats could not be loaded.");
    } finally {
      setLoading("");
    }
  };

  const applyFeePreset = (source) => {
    const stroops = feeStats?.[source];
    if (!stroops) {
      return showToast("Load fee stats before choosing a percentile.", "error");
    }

    try {
      setFeeSetting(saveFeeSetting({ source, stroops }));
      showToast(`Fee set to ${stroops} stroops per operation.`);
    } catch (err) {
      showToast(err.message || "Could not save the fee.", "error");
    }
  };

  const handleCustomFee = (event) => {
    event.preventDefault();
    try {
      const saved = saveFeeSetting({ source: "custom", stroops: customFee });
      setFeeSetting(saved);
      showToast(`Fee set to ${saved.stroops} stroops per operation.`);
    } catch (err) {
      showToast(err.message || "Could not save the fee.", "error");
    }
  };

  const refreshClawbackAssets = async () => {
    if (!publicKey) {
      setClawbackAssets([]);
      return;
    }
    try {
      const next = await getAccountBalances(publicKey);
      setClawbackAssets(
        next.filter((balance) => !balance.isNative && balance.issuer === publicKey)
      );
    } catch {
      setClawbackAssets([]);
    }
  };

  const activateTab = (tab) => {
    setActiveTab(tab);
    if (tab === "Fees") loadFeeStats();
    if (tab === "History") handleHistory();
    if (tab === "Trades") handleTrades();
    if (tab === "Lab") {
      loadLabInfo().then((info) => {
        const contractId = info?.network?.contract?.kitewell;
        refreshLabState(contractId);
        refreshTtlInfo(contractId);
        loadBuilderPage(0, contractId);
      });
    }
    if (tab === "Assets") {
      if (publicKey) refreshBalances();
      else refreshReserve();
    } else if ((tab === "Wallet" || tab === "Send") && publicKey) {
      refreshBalances();
    }
    if (tab === "Assets") refreshClawbackAssets();
  };

  const handleSimulateRegister = async () => {
    if (!publicKey) return showToast("Connect Freighter first.", "error");
    const contractId = labInfo?.network?.contract?.kitewell;
    if (!contractId) {
      return showToast(
        "No contract id configured — deploy first (contracts/README.md).",
        "error"
      );
    }
    setLoading("simulate");
    setSimulationFees(null);
    setSimulatedRegisterKey(null);
    try {
      const fees = await simulateRegisterBuilder(
        publicKey,
        contractId,
        registerForm.name
      );
      setSimulationFees(fees);
      if (fees.error) {
        showToast(`Simulation failed: ${fees.error}`, "error");
      } else {
        setSimulatedRegisterKey(
          JSON.stringify([
            publicKey,
            networkId,
            contractId,
            registerForm.name.trim(),
          ])
        );
      }
    } catch (err) {
      const error = err.message || "Simulation failed.";
      setSimulationFees({
        error,
        inclusionFee: null,
        resourceFee: null,
        totalFee: null,
        returnValue: null,
      });
      showToast(error, "error");
    } finally {
      setLoading("");
    }
  };

  const handleSep7UriChange = (value) => {
    setSep7Uri(value);
    if (!value.trim()) {
      setSep7Request(null);
      return;
    }

    try {
      const request = parseSep7PayUri(value);
      setSep7Request(request);
      setSendForm((previous) => ({
        ...previous,
        destination: request.destination,
        amount: request.amount,
        assetKey: request.assetKey,
        memoType: request.memoType,
        memo: request.memo,
      }));
    } catch (error) {
      setSep7Request(null);
      showToast(error.message || "Invalid SEP-7 pay URI.", "error");
    }
  };

  const handleTabKeyDown = (event, index) => {
    let nextIndex;

    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = TABS.length - 1;
    else return;

    event.preventDefault();
    activateTab(TABS[nextIndex]);
    tabRefs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    const destination = sendForm.destination.trim();
    if (!destination || !destination.includes("*")) {
      setResolvedFederation(null);
      return;
    }

    let cancelled = false;
    setLoading("resolve");
    setResolvedFederation(null);
    resolveFederationAddress(destination)
      .then((account) => {
        if (!cancelled) setResolvedFederation(account);
      })
      .catch((err) => {
        if (!cancelled) showToast(err.message || "Federation lookup failed.", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading("");
      });

    return () => {
      cancelled = true;
    };
  }, [sendForm.destination]);

  return (
    <div className="app">
      <div className="aurora" aria-hidden="true" />

      {toast && (
        <div
          className={`toast toast--${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          <span>{toast.message}</span>
          {toast.explorerUrl && (
            <a
              className="toast__link"
              href={toast.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              View on explorer ↗
            </a>
          )}
        </div>
      )}

      <header className="header">
        <div className="header__brand">
          <KitewellMark />
          <div className="header__titles">
            <span className="header__name">Kitewell</span>
            <span className="header__tag">Stellar {activeNetwork.label} lab</span>
          </div>
        </div>
        <div className="network">
          <span className="eyebrow">Network</span>
          <select
            id="network-select"
            className="input input--compact"
            value={networkId}
            onChange={(e) => handleNetworkChange(e.target.value)}
            aria-label="Stellar network"
          >
            {getAvailableNetworks().map((network) => (
              <option key={network.id} value={network.id}>
                {network.label}
              </option>
            ))}
          </select>
          <details className="network__custom">
            <summary>Custom network</summary>
            <form className="form" onSubmit={handleSaveCustomNetwork}>
              <input
                className="input input--compact"
                aria-label="Custom network name"
                placeholder="Network name"
                value={customNetworkForm.name}
                onChange={(event) => setCustomNetworkForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))}
                required
              />
              <input
                className="input input--compact"
                aria-label="Custom Horizon URL"
                placeholder="https://horizon.example"
                value={customNetworkForm.horizonUrl}
                onChange={(event) => setCustomNetworkForm((current) => ({
                  ...current,
                  horizonUrl: event.target.value,
                }))}
                required
              />
              <input
                className="input input--compact"
                aria-label="Custom RPC URL"
                placeholder="https://rpc.example"
                value={customNetworkForm.rpcUrl}
                onChange={(event) => setCustomNetworkForm((current) => ({
                  ...current,
                  rpcUrl: event.target.value,
                }))}
                required
              />
              <input
                className="input input--compact"
                aria-label="Custom network passphrase"
                placeholder="Network passphrase"
                value={customNetworkForm.passphrase}
                onChange={(event) => setCustomNetworkForm((current) => ({
                  ...current,
                  passphrase: event.target.value,
                }))}
                required
              />
              <div className="section__row">
                <button className="btn btn--secondary btn--sm" type="submit">
                  Save custom network
                </button>
                {getAvailableNetworks().some((network) => network.id === "CUSTOM") && (
                  <button
                    className="btn btn--secondary btn--sm"
                    type="button"
                    onClick={handleRemoveCustomNetwork}
                  >
                    Remove
                  </button>
                )}
              </div>
            </form>
          </details>
        </div>
      </header>

      <main className="main">
        <section className="hero-card">
          {publicKey ? (
            <>
              <div className="hero-card__status">
                <span className="status-dot" />
                Connected via Freighter
              </div>
              {horizonNotice && (
                <p className="muted" role="status">
                  {horizonNotice}
                </p>
              )}
              <div className="hero-card__balance">
                <span className="eyebrow">XLM balance</span>
                <span className="hero-card__amount">
                  {xlmBalance !== null
                    ? `${parseFloat(xlmBalance).toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM`
                    : "—"}
                  <button
                    className="icon-btn"
                    onClick={refreshBalances}
                    disabled={loading === "balance"}
                    title="Refresh balances"
                    aria-label="Refresh balances"
                    type="button"
                  >
                    {loading === "balance" ? <Spinner size={14} /> : "↻"}
                  </button>
                </span>
              </div>
              <div className="hero-card__key">
                <span className="eyebrow">Public key</span>
                <code>{shortenAddress(publicKey)}</code>
                <button
                  className="icon-btn"
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(publicKey);
                    showToast("Address copied.");
                  }}
                  title="Copy public key"
                  aria-label="Copy public key"
                >
                  ⎘
                </button>
                <a
                  className="text-link"
                  href={explorerAccountUrl(publicKey)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Explorer ↗
                </a>
              </div>
              {qrCodeDataUrl && (
                <div className="qr-code-panel">
                  <img
                    className="qr-code-panel__image"
                    src={qrCodeDataUrl}
                    alt="QR code for the connected public address"
                  />
                  <p className="muted qr-code-panel__hint">
                    Scan to copy the connected public address.
                  </p>
                </div>
              )}
              {balances.filter((b) => !b.isNative).length > 0 && (
                <div className="asset-chips">
                  {balances
                    .filter((b) => !b.isNative && !b.isPoolShare)
                    .slice(0, 6)
                    .map((b) => (
                      <span key={b.key} className="chip">
                        {parseFloat(b.balance).toLocaleString(undefined, {
                          maximumFractionDigits: 4,
                        })}{" "}
                        {b.code}
                      </span>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="hero-card__empty">
              <p className="hero-card__lead">No wallet connected</p>
              <p className="muted">
                Connect Freighter to fund, trust assets, and send Testnet XLM.
              </p>
            </div>
          )}
        </section>

        <TransactionFailureNotice failure={transactionFailure} />

        <nav className="tabs" aria-label="Lab sections" role="tablist">
          {TABS.map((t, index) => {
            const isActive = activeTab === t;
            const tabId = `tab-${tabSlug(t)}`;

            return (
              <button
                key={t}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                id={tabId}
                type="button"
                role="tab"
                className={`tab ${isActive ? "tab--active" : ""}`}
                aria-selected={isActive}
                aria-controls={`panel-${t.toLowerCase()}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => activateTab(t)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {t}
              </button>
            );
          })}
        </nav>

        <section
          className="panel"
          id={`panel-${tabSlug(activeTab)}`}
          role="tabpanel"
          aria-labelledby={`tab-${tabSlug(activeTab)}`}
          tabIndex={0}
        >
          {activeTab === "Wallet" && (
            <div className="section">
              <h2>Connect wallet</h2>
              {freighterInstalled === false && (
                <div className="info-box info-box--warning">
                  <span className="eyebrow">Freighter not detected</span>
                  <p className="muted">
                    Install the{" "}
                    <a href="https://www.freighter.app/" target="_blank" rel="noreferrer">
                      Freighter extension
                    </a>{" "}
                    and switch it to <strong>Testnet</strong>.
                  </p>
                </div>
              )}
              {requireWallet ? (
                <>
                  <p className="muted">
                    Kitewell requests access with Freighter&apos;s{" "}
                    <code>setAllowed</code> / <code>getAddress</code> APIs. Keys never leave
                    the extension.
                  </p>
                  <button
                    className="btn btn--primary"
                    type="button"
                    onClick={handleConnect}
                    disabled={loading === "connect" || freighterInstalled === false}
                  >
                    {loading === "connect" ? (
                      <>
                        <Spinner /> Connecting…
                      </>
                    ) : (
                      "Connect Freighter"
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="info-box">
                    <span className="eyebrow">Connected address</span>
                    <code>{publicKey}</code>
                  </div>
                  {accountDetails && (
                    <div className="info-box">
                      <span className="eyebrow">Account metadata</span>
                      <div className="metadata-grid">
                        <div>
                          <span className="metadata-label">Sequence</span>
                          <span className="metadata-value">{accountDetails.sequence}</span>
                        </div>
                        <div>
                          <span className="metadata-label">Subentries</span>
                          <span className="metadata-value">{accountDetails.subentryCount}</span>
                        </div>
                        <div>
                          <span className="metadata-label">Last modified ledger</span>
                          <span className="metadata-value">
                            {accountDetails.ledgerStatus?.lastModifiedLedger ?? "Unknown"}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">Latest Horizon ledger</span>
                          <span className="metadata-value">
                            {accountDetails.ledgerStatus?.latestLedger ?? "Unknown"}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">Thresholds</span>
                          <span className="metadata-value">
                            {accountDetails.thresholds?.low_threshold ?? "—"},{" "}
                            {accountDetails.thresholds?.med_threshold ?? "—"},{" "}
                            {accountDetails.thresholds?.high_threshold ?? "—"}
                          </span>
                        </div>
                      </div>
                      <p className="muted" role="status" style={{ marginTop: 8 }}>
                        {accountDetails.ledgerStatus?.message ?? "Ledger age unknown."}
                      </p>
                      <a
                        href={explorerAccountUrl(publicKey)}
                        className="text-link"
                        target="_blank"
                        rel="noreferrer"
                        style={{ marginTop: 8, display: "inline-block" }}
                      >
                        StellarExpert ↗
                      </a>
                    </div>
                  )}
                  <div className="info-box">
                    <span className="eyebrow">Sponsorships given</span>
                    {sponsorshipsError ? (
                      <p className="muted">{sponsorshipsError}</p>
                    ) : outgoingSponsorships === null ? (
                      <p className="muted">Reading sponsorships…</p>
                    ) : outgoingSponsorships.length === 0 ? (
                      <p className="muted">No outgoing sponsorships.</p>
                    ) : (
                      <ul className="balance-list">
                        {outgoingSponsorships.map((sponsorship) => (
                          <li
                            key={`${sponsorship.sponsoredAccount}-${sponsorship.entryType}`}
                            className="balance-row"
                          >
                            <div>
                              <strong>
                                {shortenAddress(sponsorship.sponsoredAccount)}
                              </strong>
                              <span className="muted balance-row__issuer">
                                {sponsorship.entryType}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="section__row">
                    <button className="btn btn--secondary" type="button" onClick={handleDisconnect}>
                      Disconnect
                    </button>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={handleDownloadAccountSnapshot}
                      disabled={loading === "snapshot"}
                      title="Download a JSON snapshot of this account"
                    >
                      {loading === "snapshot" ? (
                        <>
                          <Spinner /> Exporting…
                        </>
                      ) : (
                        "Download account JSON"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "Fund" && (
            <div className="section">
              <h2>Fund with Friendbot</h2>
              <p className="muted">
                Activate the account and receive free test XLM. Only available on Testnet.
              </p>
              {!friendbotAvailable && (
                <div className="info-box info-box--warning">
                  <span className="eyebrow">Friendbot unavailable</span>
                  <p className="muted">
                    Friendbot is disabled on {activeNetwork.label}. Switch to Testnet to fund an
                    account here, or fund it through a {activeNetwork.label} faucet.
                  </p>
                </div>
              )}
              {publicKey && (
                <div className="info-box">
                  <span className="eyebrow">Funding address</span>
                  <code>{publicKey}</code>
                </div>
              )}
              <button
                className="btn btn--primary"
                type="button"
                onClick={handleFund}
                disabled={loading === "fund" || requireWallet || !friendbotAvailable}
              >
                {loading === "fund" ? (
                  <>
                    <Spinner /> Funding…
                  </>
                ) : (
                  "Request Friendbot XLM"
                )}
              </button>
              <form className="form" onSubmit={handleCreateAccount}>
                <h3 className="subhead">Create account from this wallet</h3>
                <p className="muted">
                  Create and fund a new Stellar account using XLM from the connected wallet.
                </p>
                <label className="label" htmlFor="create-account-key">
                  New account public key
                </label>
                <input
                  id="create-account-key"
                  className="input"
                  value={createAccountForm.destination}
                  onChange={(e) =>
                    setCreateAccountForm((prev) => ({
                      ...prev,
                      destination: e.target.value,
                    }))
                  }
                  placeholder="G..."
                  required
                />
                <label className="label" htmlFor="create-account-balance">
                  Starting XLM balance
                </label>
                <input
                  id="create-account-balance"
                  className="input"
                  type="number"
                  min="1"
                  step="0.0000001"
                  value={createAccountForm.startingBalance}
                  onChange={(e) =>
                    setCreateAccountForm((prev) => ({
                      ...prev,
                      startingBalance: e.target.value,
                    }))
                  }
                  required
                />
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={loading === "create-account" || requireWallet}
                >
                  {loading === "create-account" ? (
                    <>
                      <Spinner /> Creating…
                    </>
                  ) : (
                    "Create and fund account"
                  )}
                </button>
              </form>
              {createAccountResult && (
                <div className="info-box">
                  <span className="eyebrow">Funding submitted</span>
                  <code>{createAccountResult.hash}</code>
                  <a
                    className="text-link"
                    href={explorerAccountUrl(createAccountResult.destination)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View new account on StellarExpert ↗
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === "Assets" && (
            <div className="section">
              <h2>Balances & trustlines</h2>
              <p className="muted">
                View holdings, open a trustline, or remove an empty one with Freighter{" "}
                <code>signTransaction</code>. Removing sets the limit to 0.
              </p>
              <div className="info-box">
                <span className="eyebrow">Minimum XLM calculator</span>
                <label className="label" htmlFor="reserve-subentries">
                  Subentry count
                </label>
                <input
                  id="reserve-subentries"
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  value={reserveSubentryCount}
                  onChange={(event) =>
                    setReserveSubentryCount(event.target.value)
                  }
                />
                {baseReserveInStroops == null ? (
                  <p className="muted">
                    {reserveError ||
                      "Connect a wallet and load the latest ledger to calculate the minimum."}
                  </p>
                ) : !/^\d+$/.test(reserveSubentryCount) ? (
                  <p className="muted">
                    Enter a non-negative whole number of subentries.
                  </p>
                ) : (
                  <p className="muted">
                    Base reserve from the latest Horizon ledger:{" "}
                    {formatStroops(baseReserveInStroops)} XLM. Minimum balance:{" "}
                    {calculateMinimumBalance(baseReserveInStroops, reserveSubentryCount)}{" "}
                    XLM.
                  </p>
                )}
              </div>

              <label className="label">
                <input
                  type="checkbox"
                  checked={hideZeroCreditAssets}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setHideZeroCreditAssets(checked);
                    try {
                      globalThis.localStorage?.setItem(
                        HIDE_ZERO_ASSETS_STORAGE_KEY,
                        String(checked)
                      );
                    } catch {
                      /* The preference remains active for this session. */
                    }
                  }}
                />{" "}
                Hide zero-balance credit assets (trustlines remain)
              </label>

              {visibleAssetBalances.length > 0 ? (
                <ul className="balance-list">
                  {visibleAssetBalances.map((b) => (
                    <li key={b.key} className="balance-row">
                      <div>
                        <strong>{b.code}</strong>
                        {!b.isNative && (
                          <span className="muted balance-row__issuer">
                            {shortenAddress(b.issuer)}
                          </span>
                        )}
                        <div className="balance-row__liabilities">
                          <span className="liability selling" title="Selling liabilities (offers selling this asset)">
                            ▼ {parseFloat(b.sellingLiabilities || "0").toLocaleString(undefined, { maximumFractionDigits: 7 })}
                          </span>
                          <span className="liability buying" title="Buying liabilities (offers buying this asset)">
                            ▲ {parseFloat(b.buyingLiabilities || "0").toLocaleString(undefined, { maximumFractionDigits: 7 })}
                          </span>
                        </div>
                      </div>
                      <div className="balance-row__actions">
                        <span>
                          Available{" "}
                          {parseFloat(b.available || b.balance).toLocaleString(undefined, {
                            maximumFractionDigits: 7,
                          })}
                        </span>
                        {!b.isNative && (
                          <button
                            className="btn btn--secondary btn--sm"
                            type="button"
                            onClick={() => handleRemoveTrust(b)}
                            disabled={loading === `remove-${b.key}`}
                            title={
                              parseFloat(b.balance) > 0
                                ? "Balance must be 0 before removing this trustline"
                                : `Remove the ${b.code} trustline`
                            }
                          >
                            {loading === `remove-${b.key}`
                              ? "Removing…"
                              : "Remove"}
                          </button>
                        )}
                      </div>
                      {!b.isNative && (
                        <div className="balance-row__actions">
                          <span className="muted">
                            Limit:{" "}
                            {b.limit
                              ? parseFloat(b.limit).toLocaleString(undefined, {
                                  maximumFractionDigits: 7,
                                })
                              : "—"}
                          </span>
                          <input
                            className="input"
                            type="number"
                            placeholder="New limit"
                            value={limitChangeForm[b.key] || ""}
                            onChange={(e) =>
                              setLimitChangeForm({
                                ...limitChangeForm,
                                [b.key]: e.target.value,
                              })
                            }
                            disabled={loading === `limit-${b.key}`}
                          />
                          <button
                            className="btn btn--secondary btn--sm"
                            type="button"
                            onClick={() => handleChangeLimit(b)}
                            disabled={
                              loading === `limit-${b.key}` || !limitChangeForm[b.key]
                            }
                          >
                            {loading === `limit-${b.key}` ? "Changing…" : "Change limit"}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">
                  {requireWallet
                    ? "Connect a wallet to load balances."
                    : "No balances yet — fund the account first."}
                </p>
              )}

              {poolShares.length > 0 && (
                <div className="section">
                  <h3 className="subhead">Liquidity pool shares</h3>
                  {poolShares.map((row) => (
                    <div key={row.poolId} className="info-box">
                      <span className="eyebrow">Pool {shortenAddress(row.poolId)}</span>
                      <div className="metadata-grid">
                        <div>
                          <span className="metadata-label">Your shares</span>
                          <span className="metadata-value">{row.shares}</span>
                        </div>
                        <div>
                          <span className="metadata-label">Total shares</span>
                          <span className="metadata-value">
                            {row.totalShares ?? "—"}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">Your share</span>
                          <span className="metadata-value">
                            {row.percentage !== null ? `${row.percentage}%` : "—"}
                          </span>
                        </div>
                      </div>
                      {row.loading ? (
                        <p className="muted">Loading pool reserves…</p>
                      ) : row.reservesUnavailable ? (
                        <p className="muted">
                          Reserves unavailable — Horizon could not load this pool.
                        </p>
                      ) : (
                        <div className="metadata-grid">
                          {row.reserves.map((reserve) => (
                            <div key={reserve.label}>
                              <span className="metadata-label">{reserve.label}</span>
                              <span className="metadata-value">{reserve.balance}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="section">
                <h3 className="subhead">Claimable balances you created</h3>
                {claimableBalances.length > 0 ? (
                  <ul className="balance-list">
                    {claimableBalances.map((balance) => (
                      <li key={balance.id} className="balance-row">
                        <div>
                          <strong>{balance.amount} {balance.code}</strong>
                          <span className="muted balance-row__issuer">
                            {balance.issuer ? shortenAddress(balance.issuer) : "Native asset"}
                          </span>
                        </div>
                        {balance.clawbackEnabled && balance.issuer === publicKey && (
                          <button
                            className="btn btn--secondary btn--sm"
                            type="button"
                            onClick={() => handleClawbackClaimable(balance)}
                            disabled={loading === `clawback-${balance.id}`}
                          >
                            {loading === `clawback-${balance.id}` ? "Clawing back…" : "Claw back"}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No claimable balances created by this account.</p>
                )}
              </div>

              <form onSubmit={handleTrust} className="form">
                <h3 className="subhead">Add trustline</h3>
                <label className="label" htmlFor="trust-asset-code">
                  Asset code
                </label>
                <input
                  id="trust-asset-code"
                  className="input"
                  value={trustForm.code}
                  onChange={(e) => setTrustForm({ ...trustForm, code: e.target.value })}
                  placeholder="USDC"
                  maxLength={12}
                  required
                />
                <label className="label" htmlFor="trust-issuer">
                  Issuer
                </label>
                <input
                  id="trust-issuer"
                  className="input"
                  value={trustForm.issuer}
                  onChange={(e) => setTrustForm({ ...trustForm, issuer: e.target.value })}
                  placeholder="G…"
                  required
                />
                <label className="label" htmlFor="trust-limit">
                  Limit
                </label>
                <input
                  id="trust-limit"
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  value={trustForm.limit}
                  onChange={(e) => setTrustForm({ ...trustForm, limit: e.target.value })}
                />
                <div className="info-box" aria-live="polite">
                  <span className="eyebrow">Trustline reserve check</span>
                  {baseReserveInStroops == null ? (
                    <p className="muted">
                      {reserveError ||
                        "Load the latest ledger before checking this trustline."}
                    </p>
                  ) : !accountDetails || trustlineMinimum == null ? (
                    <p className="muted">
                      Connect and load the source account, including its subentry count, to check its reserve.
                    </p>
                  ) : trustlineCheckError ? (
                    <p className="muted">{trustlineCheckError}</p>
                  ) : (
                    <>
                      <span>
                        Extra reserve:{" "}
                        {trustlineAlreadyExists
                          ? "0.0000000"
                          : formatStroops(baseReserveInStroops)}{" "}
                        XLM
                      </span>
                      <span>
                        Required after trustline and fee:{" "}
                        {formatStroops(
                          trustlineMinimum + BigInt(TRANSACTION_FEE_STROOPS)
                        )}{" "}
                        XLM
                      </span>
                      <strong>
                        {trustlineAffordable
                          ? "Source can cover the reserve and fee."
                          : "Source balance is below the required reserve and fee."}
                      </strong>
                    </>
                  )}
                </div>
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={
                    loading === "trust" ||
                    requireWallet ||
                    !accountDetails ||
                    baseReserveInStroops == null ||
                    !trustlineAffordable
                  }
                >
                  {loading === "trust" ? (
                    <>
                      <Spinner /> Signing…
                    </>
                  ) : (
                    "Sign changeTrust"
                  )}
                </button>
              </form>

              {txWatchPanel}
            </div>
          )}

          {activeTab === "Issuer" && (
            <div className="section">
              <div className="section__row">
                <h2>Issuer controls</h2>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={refreshIssuerPanel}
                  disabled={loading === "issuer" || requireWallet}
                >
                  {loading === "issuer" ? (
                    <>
                      <Spinner /> Loading…
                    </>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
              <p className="muted">
                Reads auth flags from Horizon and signs <code>setOptions</code> /{" "}
                <code>allowTrust</code> with Freighter.
              </p>

              {requireWallet ? (
                <p className="muted">Connect Freighter to manage an issuer.</p>
              ) : (
                <>
                  {issuerConfigError && (
                    <div className="info-box info-box--warning">
                      <span className="eyebrow">Account flags</span>
                      <p className="muted">{issuerConfigError}</p>
                    </div>
                  )}

                  {issuerConfig && (
                    <form className="form" onSubmit={handleSetIssuerOptions}>
                      <div className="info-box">
                        <span className="eyebrow">Current account flags</span>
                        <div className="metadata-grid">
                          <div>
                            <span className="metadata-label">Home domain</span>
                            <span className="metadata-value">
                              {issuerConfig.homeDomain || "—"}
                            </span>
                          </div>
                          <div>
                            <span className="metadata-label">Auth required</span>
                            <span className="metadata-value">
                              {String(issuerConfig.authRequired)}
                            </span>
                          </div>
                          <div>
                            <span className="metadata-label">Auth revocable</span>
                            <span className="metadata-value">
                              {String(issuerConfig.authRevocable)}
                            </span>
                          </div>
                          <div>
                            <span className="metadata-label">Auth immutable</span>
                            <span className="metadata-value">
                              {String(issuerConfig.authImmutable)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <label className="label" htmlFor="issuer-home-domain">
                        Home domain (32 bytes max)
                      </label>
                      <input
                        id="issuer-home-domain"
                        className="input"
                        type="text"
                        value={issuerForm.homeDomain}
                        onChange={(e) =>
                          setIssuerForm({
                            ...issuerForm,
                            homeDomain: e.target.value,
                          })
                        }
                        disabled={issuerConfig.authImmutable}
                      />

                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={issuerForm.authRequired}
                          onChange={(e) =>
                            setIssuerForm({
                              ...issuerForm,
                              authRequired: e.target.checked,
                            })
                          }
                          disabled={issuerConfig.authImmutable}
                        />
                        Auth required — holders need approval
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={issuerForm.authRevocable}
                          onChange={(e) =>
                            setIssuerForm({
                              ...issuerForm,
                              authRevocable: e.target.checked,
                            })
                          }
                          disabled={issuerConfig.authImmutable}
                        />
                        Auth revocable — the issuer can revoke holders
                      </label>

                      {!issuerConfig.authImmutable && (
                        <div className="info-box info-box--warning">
                          <span className="eyebrow">Irreversible</span>
                          <p className="muted">
                            Auth immutable can never be turned off. It is a
                            separate control from the two flags above.
                          </p>
                        </div>
                      )}
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={issuerConfig.authImmutable || issuerForm.authImmutable}
                          onChange={(e) =>
                            setIssuerForm({
                              ...issuerForm,
                              authImmutable: e.target.checked,
                              confirmation: "",
                            })
                          }
                          disabled={issuerConfig.authImmutable}
                        />
                        Auth immutable (one-way)
                      </label>

                      {issuerForm.authImmutable && !issuerConfig.authImmutable && (
                        <>
                          <label
                            className="label"
                            htmlFor="immutable-confirmation"
                          >
                            Type {IMMUTABLE_CONFIRMATION} to confirm
                          </label>
                          <input
                            id="immutable-confirmation"
                            className="input"
                            type="text"
                            value={issuerForm.confirmation}
                            onChange={(e) =>
                              setIssuerForm({
                                ...issuerForm,
                                confirmation: e.target.value,
                              })
                            }
                            placeholder={IMMUTABLE_CONFIRMATION}
                          />
                        </>
                      )}

                      <button
                        className="btn btn--primary"
                        type="submit"
                        disabled={
                          loading === "issuer-update" ||
                          issuerConfig.authImmutable ||
                          (issuerForm.authImmutable &&
                            issuerForm.confirmation !== IMMUTABLE_CONFIRMATION)
                        }
                      >
                        {loading === "issuer-update" ? (
                          <>
                            <Spinner /> Signing…
                          </>
                        ) : (
                          "Sign setOptions"
                        )}
                      </button>
                      {issuerConfig.authImmutable && (
                        <p className="muted">
                          Flags are locked on-chain — auth immutable is already
                          set.
                        </p>
                      )}
                    </form>
                  )}

                  <h3 className="subhead">Trustlines you issued</h3>
                  {issuedTrustlinesError && (
                    <div className="info-box info-box--warning">
                      <p className="muted">{issuedTrustlinesError}</p>
                    </div>
                  )}
                  {issuedTrustlines.length > 0 ? (
                    <ul className="balance-list">
                      {issuedTrustlines.map((entry) => (
                        <li key={entry.key} className="balance-row">
                          <div>
                            <strong>{entry.assetCode}</strong>
                            <span className="muted balance-row__issuer">
                              {shortenAddress(entry.holder)} · {entry.balance}
                            </span>
                          </div>
                          <div className="balance-row__actions">
                            <span className="muted">
                              {entry.isAuthorized === null
                                ? "status unknown"
                                : entry.isAuthorized
                                  ? "authorized"
                                  : "not authorized"}
                            </span>
                            <button
                              className="btn btn--secondary btn--sm"
                              type="button"
                              onClick={() => handleAllowTrust(entry, true)}
                              disabled={loading === `allow-${entry.key}`}
                            >
                              Authorize
                            </button>
                            <button
                              className="btn btn--secondary btn--sm"
                              type="button"
                              onClick={() => handleAllowTrust(entry, false)}
                              disabled={loading === `allow-${entry.key}`}
                            >
                              Revoke
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !issuedTrustlinesError && (
                      <p className="muted">
                        No accounts hold an asset issued by this address.
                      </p>
                    )
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "Send" && (
            <div className="section">
              <h2>Send payment</h2>
              <p className="muted">
                Builds a payment op for XLM or a credit asset you hold. Review the unsigned
                envelope XDR, then sign in Freighter to submit it to Horizon Testnet.
              </p>
              <form onSubmit={handleSend} className="form">
                <label className="label" htmlFor="sep7-uri">
                  SEP-7 payment URI
                </label>
                <input
                  id="sep7-uri"
                  className="input"
                  type="text"
                  placeholder="web+stellar:pay?destination=G..."
                  value={sep7Uri}
                  onChange={(e) => handleSep7UriChange(e.target.value)}
                />
                {sep7Request && (
                  <div className="muted">
                    <p>Payment details imported from SEP-7.</p>
                    <p>
                      Origin domain: {sep7Request.originDomain || "Not provided"}
                    </p>
                    <p>
                      Signature: {sep7Request.signature || "Not provided"}
                    </p>
                  </div>
                )}
                <label className="label" htmlFor="send-destination">
                  Destination (G… or M…)
                </label>
                <input
                  id="send-destination"
                  className="input"
                  type="text"
                  placeholder="G… or M…"
                  value={sendForm.destination}
                  onChange={(e) => updateSendForm({ destination: e.target.value })}
                  required
                />
                {muxedSendBase && (
                  <p className="muted">
                    Muxed payment arrives at {shortenAddress(muxedSendBase)} (the
                    base account).
                  </p>
                )}
                <label className="label" htmlFor="send-asset">
                  Asset
                </label>
                <select
                  id="send-asset"
                  className="input"
                  value={sendForm.assetKey}
                  onChange={(e) => updateSendForm({ assetKey: e.target.value })}
                >
                  <option value="native">XLM (native)</option>
                  {sep7Request?.assetKey && sep7Request.assetKey !== "native" &&
                    !balances.some((b) => b.key === sep7Request.assetKey) && (
                      <option value={sep7Request.assetKey}>
                        {sep7Request.assetCode} · requested by SEP-7
                      </option>
                    )}
                  {balances
                    .filter((b) => !b.isNative)
                    .map((b) => {
                      const available = parseFloat(b.balance) - parseFloat(b.sellingLiabilities || "0");
                      return (
                        <option key={b.key} value={b.key}>
                          {b.code} ·{" "}
                          {available.toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}
                        </option>
                      );
                    })}
                </select>
                {selectedSendAsset?.isAuthorized === false && (
                  <p className="muted" role="alert">
                    {selectedSendAsset.code} is unauthorized by its issuer, so it cannot be selected as a send asset.
                  </p>
                )}
                <label className="label" htmlFor="send-amount">
                  Amount ({selectedSendAsset?.code ?? "XLM"}){selectedSendAssetAvailable !== null ? ` · Available: ${selectedSendAssetAvailable.toFixed(7)}` : ""}
                </label>
                <input
                  id="send-amount"
                  className="input"
                  type="number"
                  step="0.0000001"
                  min="0.0000001"
                  placeholder="e.g. 10"
                  value={sendForm.amount}
                  onChange={(e) => updateSendForm({ amount: e.target.value })}
                  required
                />
                <label className="label" htmlFor="send-memo-type">
                  Memo type
                </label>
                <select
                  id="send-memo-type"
                  className="input"
                  value={sendForm.memoType}
                  onChange={(e) =>
                    updateSendForm({
                      memoType: e.target.value,
                      memo: "",
                    })
                  }
                >
                  <option value="text">Text</option>
                  <option value="id">ID</option>
                  <option value="hash">Hash</option>
                </select>
                <label className="label" htmlFor="send-memo">
                  Memo (optional)
                </label>
                <input
                  id="send-memo"
                  className="input"
                  type="text"
                  maxLength={memoField.maxLength}
                  pattern={memoField.pattern}
                  inputMode={memoField.inputMode}
                  placeholder={memoField.placeholder}
                  value={sendForm.memo}
                  onChange={(e) => updateSendForm({ memo: e.target.value })}
                />
                {unsignedEnvelope && (
                  <div className="info-box">
                    <span className="eyebrow">Unsigned envelope XDR</span>
                    <code style={{ wordBreak: "break-all" }}>
                      {unsignedEnvelope}
                    </code>
                    <p className="muted">
                      Copy this envelope to hand it to another signer or the decoder.
                      Copying does not sign or submit it.
                    </p>
                    <button
                      className="btn btn--secondary btn--sm"
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(unsignedEnvelope);
                        showToast(
                          "Unsigned envelope copied. Nothing was signed or submitted.",
                          "info"
                        );
                      }}
                    >
                      Copy XDR
                    </button>
                  </div>
                )}
                {signingConfirmationOpen && (
                  <SigningPassphraseConfirmation
                    network={activeNetwork}
                    onConfirm={handleConfirmedSend}
                    onCancel={() => {
                      setSigningConfirmationOpen(false);
                      showToast("Signing cancelled. Nothing was signed.", "info");
                    }}
                  />
                )}
                <div className="section__row">
                  <button
                    className="btn btn--secondary"
                    type="button"
                    onClick={handlePreviewEnvelope}
                    disabled={loading === "preview" || requireWallet}
                  >
                    {loading === "preview" ? (
                      <>
                        <Spinner /> Building…
                      </>
                    ) : (
                      "Build unsigned envelope"
                    )}
                  </button>
                  <button
                    className="btn btn--primary"
                    type="submit"
                    disabled={
                      loading === "send" ||
                      loading === "preview" ||
                      signingConfirmationOpen ||
                      requireWallet
                    }
                  >
                    {loading === "send" ? (
                      <>
                        <Spinner /> Signing in Freighter…
                      </>
                    ) : (
                      "Sign & send"
                    )}
                  </button>
                </div>
              </form>

              {sendPrepared && (
                <div className="info-box">
                  <span className="eyebrow">Review payment</span>

                  <p>
                    <strong>Destination:</strong>
                    <br />
                    {sendPrepared.summary.destination}
                  </p>

                  <p>
                    <strong>Amount:</strong>
                    <br />
                    {sendPrepared.summary.amount}
                  </p>

                  <p>
                    <strong>Asset:</strong>
                    <br />
                    {sendPrepared.summary.asset}
                  </p>

                  <p>
                    <strong>Memo:</strong>
                    <br />
                    {sendPrepared.summary.memo}
                  </p>

                  <p>
                    <strong>Network fee:</strong>
                    <br />
                    {sendPrepared.summary.fee} stroops
                  </p>

                  <div className="info-box__actions">
                    <button
                      className="btn btn--primary"
                      type="button"
                      onClick={handleConfirmSend}
                      disabled={loading === "send"}
                    >
                      {loading === "send" ? (
                        <>
                          <Spinner /> Waiting for Freighter…
                        </>
                      ) : (
                        "Confirm in Freighter"
                      )}
                    </button>

                    <button
                      className="btn btn--secondary"
                      type="button"
                      disabled={loading === "send"}
                      onClick={() => setSendPrepared(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "Path" && (
            <div className="section">
              <h2>Path payment</h2>
              <p className="muted">
                Builds a <code>pathPaymentStrictSend</code> /{" "}
                <code>pathPaymentStrictReceive</code> op, signs it in Freighter, then submits
                it to Horizon Testnet.
              </p>
              <form onSubmit={handlePathPayment} className="form">
                <label className="label" htmlFor="path-mode">
                  Mode
                </label>
                <select
                  id="path-mode"
                  className="input"
                  value={pathForm.mode}
                  onChange={(e) => updatePathForm({ mode: e.target.value })}
                >
                  <option value="strictSend">Strict send — fix the amount sent</option>
                  <option value="strictReceive">Strict receive — fix the amount received</option>
                </select>

                <label className="label" htmlFor="path-destination">
                  Destination
                </label>
                <input
                  id="path-destination"
                  className="input"
                  type="text"
                  placeholder="G…"
                  value={pathForm.destination}
                  onChange={(e) => updatePathForm({ destination: e.target.value })}
                  required
                />

                <label className="label" htmlFor="path-send-asset">
                  Send asset
                </label>
                <select
                  id="path-send-asset"
                  className="input"
                  value={pathForm.sendAssetType}
                  onChange={(e) => updatePathForm({ sendAssetType: e.target.value })}
                >
                  <option value="native">XLM (native)</option>
                  <option value="credit">Credit asset</option>
                </select>
                {pathForm.sendAssetType === "credit" && (
                  <>
                    <input
                      className="input"
                      type="text"
                      placeholder="Asset code, e.g. USDC"
                      maxLength={12}
                      value={pathForm.sendCode}
                      onChange={(e) => updatePathForm({ sendCode: e.target.value })}
                      required
                    />
                    <input
                      className="input"
                      type="text"
                      placeholder="Send asset issuer G…"
                      value={pathForm.sendIssuer}
                      onChange={(e) => updatePathForm({ sendIssuer: e.target.value })}
                      required
                    />
                  </>
                )}

                <label className="label" htmlFor="path-dest-asset">
                  Destination asset
                </label>
                <select
                  id="path-dest-asset"
                  className="input"
                  value={pathForm.destAssetType}
                  onChange={(e) => updatePathForm({ destAssetType: e.target.value })}
                >
                  <option value="native">XLM (native)</option>
                  <option value="credit">Credit asset</option>
                </select>
                {pathForm.destAssetType === "credit" && (
                  <>
                    <input
                      className="input"
                      type="text"
                      placeholder="Asset code, e.g. USDC"
                      maxLength={12}
                      value={pathForm.destCode}
                      onChange={(e) => updatePathForm({ destCode: e.target.value })}
                      required
                    />
                    <input
                      className="input"
                      type="text"
                      placeholder="Destination asset issuer G…"
                      value={pathForm.destIssuer}
                      onChange={(e) => updatePathForm({ destIssuer: e.target.value })}
                      required
                    />
                  </>
                )}

                <label className="label" htmlFor="path-amount">
                  {pathModeField.amountLabel}
                </label>
                <input
                  id="path-amount"
                  className="input"
                  type="number"
                  step="0.0000001"
                  min="0.0000001"
                  placeholder="e.g. 10"
                  value={pathForm.amount}
                  onChange={(e) => updatePathForm({ amount: e.target.value })}
                  required
                />

                <label className="label" htmlFor="path-bound">
                  {pathModeField.boundLabel}
                </label>
                <input
                  id="path-bound"
                  className="input"
                  type="number"
                  step="0.0000001"
                  min="0.0000001"
                  placeholder="e.g. 9.5"
                  value={pathForm.bound}
                  onChange={(e) => updatePathForm({ bound: e.target.value })}
                  required
                />
                <p className="muted">{pathModeField.boundHint}</p>

                <label className="label" htmlFor="path-hops">
                  Intermediate path (optional)
                </label>
                <input
                  id="path-hops"
                  className="input"
                  type="text"
                  placeholder="CODE:ISSUER, CODE:ISSUER"
                  value={pathForm.path}
                  onChange={(e) => updatePathForm({ path: e.target.value })}
                />
                <p className="muted">
                  Leave empty to route through the direct order book. Intermediate hops add a
                  fixed path to the operation.
                </p>

                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={handlePathQuote}
                  disabled={loading === "pathquote"}
                >
                  {loading === "pathquote" ? (
                    <>
                      <Spinner /> Asking Horizon…
                    </>
                  ) : (
                    "Get a Horizon path quote"
                  )}
                </button>

                {pathQuote && (
                  <div className="info-box">
                    <span className="eyebrow">Horizon paths</span>
                    {pathQuote.error ? (
                      <p className="muted">{pathQuote.error}</p>
                    ) : (
                      <div className="tx-list">
                        {pathQuote.paths.map((quote, index) => {
                          const hops = formatPathHops(quote.path);
                          const destLabel =
                            pathForm.destAssetType === "native"
                              ? "XLM"
                              : pathForm.destCode;
                          const sendLabel =
                            pathForm.sendAssetType === "native"
                              ? "XLM"
                              : pathForm.sendCode;
                          const estimate =
                            pathForm.mode === "strictSend"
                              ? `${quote.destinationAmount} ${destLabel} received`
                              : `${quote.sourceAmount} ${sendLabel} spent`;
                          return (
                            <div key={`${hops}-${index}`} className="tx-item">
                              <div className="tx-item__amount">
                                {hops || "Direct path"}
                              </div>
                              <div className="tx-item__addr muted">
                                {estimate}
                              </div>
                              <button
                                className="btn btn--secondary"
                                type="button"
                                onClick={() => handleUsePath(quote.path)}
                              >
                                Use this path
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={loading === "path" || requireWallet}
                >
                  {loading === "path" ? (
                    <>
                      <Spinner /> Signing in Freighter…
                    </>
                  ) : (
                    "Sign & submit path payment"
                  )}
                </button>
              </form>

              {pathResult && (
                <div className="info-box">
                  <span className="eyebrow">Path payment submitted</span>
                  <code>{pathResult.hash}</code>
                  <a
                    className="text-link"
                    href={pathResult.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ marginTop: 6, display: "inline-block" }}
                  >
                    View on StellarExpert ↗
                  </a>
                </div>
              )}

              {txWatchPanel}
            </div>
          )}

          {activeTab === "Order" && (
            <div className="section">
              <div className="section__row">
                <h2>Order Book</h2>
                <p className="muted">
                  Place, list, and cancel offers using your account assets.
                </p>
              </div>
              {publicKey ? (
                <>
                  <form className="form" onSubmit={handlePlaceOffer}>
                    <label className="label" htmlFor="offer-selling-asset">
                      Selling asset
                    </label>
                    <select
                      id="offer-selling-asset"
                      className="input"
                      value={offerForm.sellingAssetKey}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          sellingAssetKey: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="" disabled>
                        Choose a held asset
                      </option>
                      {sellableAssets.map((asset) => (
                        <option key={asset.key} value={asset.key}>
                          {asset.isNative
                            ? "XLM (native)"
                            : `${asset.code} · ${shortenAddress(asset.issuer)}`}
                        </option>
                      ))}
                    </select>
                    <label className="label" htmlFor="offer-buying-asset">
                      Buying asset
                    </label>
                    <select
                      id="offer-buying-asset"
                      className="input"
                      value={offerForm.buyingAssetKey}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          buyingAssetKey: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="" disabled>
                        Choose an asset you can receive
                      </option>
                      {assetBalances.map((asset) => (
                        <option key={asset.key} value={asset.key}>
                          {asset.isNative
                            ? "XLM (native)"
                            : `${asset.code} · ${shortenAddress(asset.issuer)}`}
                        </option>
                      ))}
                    </select>
                    <p className="muted">
                      Price is the buying-asset amount per one selling-asset unit.
                    </p>
                    <label className="label" htmlFor="offer-price-numerator">
                      Price numerator
                    </label>
                    <input
                      id="offer-price-numerator"
                      className="input"
                      type="number"
                      min="1"
                      step="1"
                      value={offerForm.priceNumerator}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          priceNumerator: e.target.value,
                        })
                      }
                      required
                    />
                    <label className="label" htmlFor="offer-price-denominator">
                      Price denominator
                    </label>
                    <input
                      id="offer-price-denominator"
                      className="input"
                      type="number"
                      min="1"
                      step="1"
                      value={offerForm.priceDenominator}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          priceDenominator: e.target.value,
                        })
                      }
                      required
                    />
                    <label className="label" htmlFor="offer-amount">
                      Amount to sell
                    </label>
                    <input
                      id="offer-amount"
                      className="input"
                      type="number"
                      min="0.0000001"
                      step="0.0000001"
                      value={offerForm.amount}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          amount: e.target.value,
                        })
                      }
                      required
                    />
                    <button
                      className="btn btn--primary"
                      type="submit"
                      disabled={loading === "offer-place"}
                    >
                      {loading === "offer-place" ? "Submitting…" : "Place offer"}
                    </button>
                  </form>

                  <div className="section__row">
                    <h3 className="subhead">Active offers</h3>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={handleListOffers}
                      disabled={loadingOffers}
                    >
                      {loadingOffers ? "Loading…" : "Refresh offers"}
                    </button>
                  </div>
                  {offerList.length > 0 ? (
                    <ul className="balance-list">
                      {offerList.map((offer) => {
                        const assetLabel = (asset) =>
                          asset.isNative
                            ? "XLM"
                            : `${asset.code} · ${shortenAddress(asset.issuer)}`;
                        return (
                          <li key={offer.offerId} className="balance-row">
                            <div>
                              <strong>Offer {offer.offerId}</strong>
                              <p className="muted">
                                Sell {offer.amount} {assetLabel(offer.selling)} for{" "}
                                {assetLabel(offer.buying)} at{" "}
                                {offer.priceNumerator}/{offer.priceDenominator}
                              </p>
                            </div>
                            <button
                              className="btn btn--secondary btn--sm"
                              type="button"
                              onClick={() => handleCancelOffer(offer)}
                              disabled={
                                loading === `offer-cancel-${offer.offerId}`
                              }
                            >
                              {loading === `offer-cancel-${offer.offerId}`
                                ? "Cancelling…"
                                : "Cancel"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="muted">No active offers loaded.</p>
                  )}
                </>
              ) : (
                <p className="muted">Connect Freighter to manage offers.</p>
              )}
            </div>
          )}

          {activeTab === "Inspect" && (
            <div className="section">
              <div className="section__row">
                <h2>Inspect transaction</h2>
              </div>
              <p className="muted">
                Paste a base64 transaction envelope to read it before signing. It is
                decoded locally on {activeNetwork.label}; nothing is submitted.
              </p>
              <form className="form" onSubmit={handleInspect}>
                <label className="label" htmlFor="inspect-xdr">
                  Transaction envelope (base64 XDR)
                </label>
                <textarea
                  id="inspect-xdr"
                  className="input"
                  rows={5}
                  spellCheck={false}
                  placeholder="AAAAAgAAAAA..."
                  value={inspectForm.xdr}
                  onChange={(e) =>
                    setInspectForm({ ...inspectForm, xdr: e.target.value })
                  }
                />
                <button className="btn btn--primary" type="submit">
                  Decode
                </button>
              </form>
              {inspectError && (
                <div className="info-box info-box--warning" role="alert">
                  <span className="eyebrow">Could not decode</span>
                  <p className="muted">{inspectError}</p>
                </div>
              )}
              {inspectResult && <DecodedEnvelope decoded={inspectResult} />}
              {!inspectResult && !inspectError && (
                <p className="muted">
                  The source, fee, sequence, memo, time bounds, and one block per
                  operation will appear here.
                </p>
              )}
              <TransactionHashLookup key={networkId} />
            </div>
          )}

          {activeTab === "Muxed" && (
            <div className="section">
              <h2>Muxed accounts</h2>
              <p className="muted">
                An M… address combines a G… base account with an unsigned 64-bit
                id. A payment to the M… address still credits the base account.
              </p>

              {muxedError && (
                <div className="info-box info-box--warning" role="alert">
                  <span className="eyebrow">Muxed address</span>
                  <p className="muted">{muxedError}</p>
                </div>
              )}

              <form className="form" onSubmit={handleBuildMuxed}>
                <div className="subhead">Build an M address</div>
                <label className="label" htmlFor="muxed-base-address">
                  Base account (G…)
                </label>
                <input
                  id="muxed-base-address"
                  className="input"
                  type="text"
                  placeholder="G…"
                  value={muxedBuildForm.gAddress}
                  onChange={(e) =>
                    setMuxedBuildForm({
                      ...muxedBuildForm,
                      gAddress: e.target.value,
                    })
                  }
                />
                <label className="label" htmlFor="muxed-id">
                  Id (unsigned 64-bit)
                </label>
                <input
                  id="muxed-id"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={muxedBuildForm.id}
                  onChange={(e) =>
                    setMuxedBuildForm({
                      ...muxedBuildForm,
                      id: e.target.value,
                    })
                  }
                />
                <button className="btn btn--secondary" type="submit">
                  Build M address
                </button>
              </form>

              {muxedBuildResult && (
                <div className="info-box">
                  <span className="eyebrow">Muxed address</span>
                  <code>{muxedBuildResult}</code>
                </div>
              )}

              <form className="form" onSubmit={handleSplitMuxed}>
                <div className="subhead">Split an M address</div>
                <label className="label" htmlFor="muxed-address">
                  Muxed address (M…)
                </label>
                <input
                  id="muxed-address"
                  className="input"
                  type="text"
                  placeholder="M…"
                  value={muxedSplitForm.mAddress}
                  onChange={(e) =>
                    setMuxedSplitForm({ mAddress: e.target.value })
                  }
                />
                <button className="btn btn--secondary" type="submit">
                  Split M address
                </button>
              </form>

              {muxedSplitResult && (
                <div className="info-box">
                  <span className="eyebrow">Base account and id</span>
                  <div className="metadata-grid">
                    <div>
                      <span className="metadata-label">Base account</span>
                      <span className="metadata-value">
                        {muxedSplitResult.gAddress}
                      </span>
                    </div>
                    <div>
                      <span className="metadata-label">Id</span>
                      <span className="metadata-value">
                        {muxedSplitResult.id}
                      </span>
                    </div>
                  </div>
                  <p className="muted" style={{ marginTop: 6 }}>
                    Payments to this M address arrive at the base account above.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "Fees" && (
            <div className="section">
              <div className="section__row">
                <h2>Network fee</h2>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={loadFeeStats}
                  disabled={loading === "feestats"}
                >
                  {loading === "feestats" ? (
                    <>
                      <Spinner /> Loading…
                    </>
                  ) : (
                    "Refresh stats"
                  )}
                </button>
              </div>
              <p className="muted">
                Horizon reports the fees charged in the last ledger. Pick one of its
                percentiles or type your own; the next payment, trustline, or path
                payment uses that fee per operation.
              </p>

              <div className="info-box">
                <span className="eyebrow">Current fee</span>
                <code>
                  {feeSetting
                    ? `${feeSetting.stroops} stroops per operation`
                    : "SDK default (100 stroops per operation)"}
                </code>
                {feeSetting && (
                  <p className="muted" style={{ marginTop: 6 }}>
                    Source:{" "}
                    {feeSetting.source === "custom"
                      ? "custom"
                      : `Horizon ${feeSetting.source}`}
                  </p>
                )}
              </div>

              {feeStatsError && (
                <div className="info-box info-box--warning" role="alert">
                  <span className="eyebrow">Fee stats</span>
                  <p className="muted">{feeStatsError}</p>
                </div>
              )}

              {feeStats && (
                <div className="info-box">
                  <span className="eyebrow">
                    Last ledger
                    {feeStats.lastLedger ? ` · ${feeStats.lastLedger}` : ""}
                  </span>
                  <div className="metadata-grid">
                    {FEE_PERCENTILES.map(({ key, label }) => (
                      <div key={key}>
                        <span className="metadata-label">{label}</span>
                        <span className="metadata-value">
                          {feeStats[key]} stroops
                        </span>
                        <button
                          className="btn btn--secondary"
                          type="button"
                          onClick={() => applyFeePreset(key)}
                        >
                          Use {label}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form className="form" onSubmit={handleCustomFee}>
                <label className="label" htmlFor="custom-fee">
                  Custom fee (stroops per operation)
                </label>
                <input
                  id="custom-fee"
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 500"
                  value={customFee}
                  onChange={(e) => setCustomFee(e.target.value)}
                />
                <button className="btn btn--secondary" type="submit">
                  Use custom fee
                </button>
              </form>
            </div>
          )}

          {activeTab === "Offers" && (
            <div className="section">
              <h2>Watch an offer</h2>
              <p className="muted">
                Paste the id returned when an offer was placed. The panel polls the
                remaining amount and price until the offer leaves the book or you stop
                watching. Stopping the watch does not cancel the offer.
              </p>

              <form className="form" onSubmit={handleWatchOffer}>
                <label className="label" htmlFor="offer-id">
                  Offer id
                </label>
                <input
                  id="offer-id"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]+"
                  placeholder="e.g. 123456789"
                  value={offerWatchId}
                  onChange={(e) => setOfferWatchId(e.target.value)}
                  required
                />
                <p className="muted">
                  Watching only reads the order book. Offer placement and cancellation
                  stay outside this panel.
                </p>
                <div className="section__row">
                  <button className="btn btn--primary" type="submit">
                    Watch offer
                  </button>
                  {offerWatch &&
                    (offerWatch.status === "watching" ||
                      offerWatch.status === "open") && (
                      <button
                        className="btn btn--secondary"
                        type="button"
                        onClick={stopOfferWatch}
                      >
                        Stop watching
                      </button>
                    )}
                </div>
              </form>

              {offerWatchError && (
                <div className="info-box info-box--warning" role="alert">
                  <span className="eyebrow">Offer watch</span>
                  <p className="muted">{offerWatchError}</p>
                </div>
              )}

              {offerWatch && (
                <div className="info-box" role="status" aria-live="polite">
                  <span className="eyebrow">Offer {offerWatch.offerId}</span>
                  {offerWatch.status === "watching" && (
                    <p className="muted">Waiting for the first poll…</p>
                  )}
                  {offerWatch.status === "open" && (
                    <div className="metadata-grid">
                      <div>
                        <span className="metadata-label">Remaining</span>
                        <span className="metadata-value">{offerWatch.amount}</span>
                      </div>
                      <div>
                        <span className="metadata-label">Price</span>
                        <span className="metadata-value">{offerWatch.price ?? "—"}</span>
                      </div>
                      <div>
                        <span className="metadata-label">Selling / buying</span>
                        <span className="metadata-value">
                          {offerWatch.selling ?? "—"} / {offerWatch.buying ?? "—"}
                        </span>
                      </div>
                    </div>
                  )}
                  {offerWatch.status === "gone" && (
                    <>
                      <p className="muted">
                        The offer is no longer in the book.
                        {" "}
                        {offerWatch.stillListed === true
                          ? "This account still lists it."
                          : offerWatch.stillListed === false
                            ? "This account no longer lists it."
                            : publicKey
                              ? "Whether the account still lists it could not be read."
                              : "Connect Freighter to check whether the account still lists it."}
                      </p>
                      <p className="muted">
                        The panel does not guess whether it filled or was cancelled.
                      </p>
                    </>
                  )}
                  {offerWatch.status === "stopped" && (
                    <p className="muted">
                      Watch stopped. The offer was not cancelled.
                    </p>
                  )}
                  {offerWatch.status === "still-open" && (
                    <p className="muted">
                      The watch window ended while the offer was still in the book.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "Lab" && (
            <div className="section">
              <div className="section__row">
                <h2>Lab stack</h2>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={loadLabInfo}
                  disabled={loading === "lab"}
                >
                  {loading === "lab" ? (
                    <>
                      <Spinner /> Checking…
                    </>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
              <p className="muted">
                Kitewell is a monorepo: <code>frontend</code> · <code>backend</code> ·{" "}
                <code>contracts</code>. This panel reads the local API and contract config.
              </p>
              {labError && (
                <div className="info-box info-box--warning">
                  <span className="eyebrow">Backend</span>
                  <p className="muted">{labError}</p>
                </div>
              )}
              {labInfo && (
                <>
                  <div className="info-box">
                    <span className="eyebrow">Backend health</span>
                    <code>
                      {labInfo.health.service} · {labInfo.health.network} · ok=
                      {String(labInfo.health.ok)}
                    </code>
                  </div>
                  <div className="info-box">
                    <span className="eyebrow">Horizon</span>
                    <code>{labInfo.network.horizonUrl}</code>
                  </div>
                  <div className="info-box">
                    <span className="eyebrow">Soroban · kitewell</span>
                    <code>
                      {activeContractId ||
                        "Not deployed yet — deploy below or see contracts/README.md"}
                    </code>
                    <p className="muted" style={{ marginTop: 6 }}>
                      Status:{" "}
                      {sessionContractId
                        ? "deployed this session"
                        : labInfo.network.contract?.status}
                    </p>
                  </div>
                  {!configuredContractId && (
                    <div className="info-box">
                      <span className="eyebrow">Deploy from Wasm</span>
                      <p className="muted">
                        No contract id is configured on the backend. Install the registry
                        Wasm, then run <code>init</code> with your connected account as
                        admin.
                      </p>
                      <label className="label" htmlFor="kitewell-wasm">
                        kitewell.wasm
                      </label>
                      <input
                        id="kitewell-wasm"
                        className="input"
                        type="file"
                        accept=".wasm,application/wasm"
                        onChange={(e) => {
                          setWasmFile(e.target.files?.[0] ?? null);
                          setConfirmRedeploy(false);
                          setDeployError(null);
                        }}
                      />
                      <p className="muted">
                        Build with <code>npm run build:contracts</code> (output:{" "}
                        <code>contracts/target/wasm32v1-none/release/kitewell.wasm</code>).
                      </p>
                      {!confirmRedeploy && (
                        <button
                          className="btn btn--secondary"
                          type="button"
                          onClick={handleDeploy}
                          disabled={
                            loading === "deploy" || requireWallet || !wasmFile
                          }
                        >
                          {loading === "deploy" ? (
                            <>
                              <Spinner /> Installing &amp; initialising…
                            </>
                          ) : sessionContractId ? (
                            "Deploy another…"
                          ) : (
                            "Install & init"
                          )}
                        </button>
                      )}
                      {!publicKey && (
                        <p className="muted">
                          Connect Freighter to sign the install and init transactions.
                        </p>
                      )}
                      {sessionContractId && !confirmRedeploy && (
                        <p className="muted">
                          First id stays visible below; deploying again creates a new one
                          and asks for confirmation first.
                        </p>
                      )}
                      {confirmRedeploy && (
                        <div className="info-box info-box--warning" style={{ marginTop: 8 }}>
                          <span className="eyebrow">Confirm re-deploy</span>
                          <p className="muted">
                            A contract was already deployed this session:{" "}
                            <code>{sessionContractId}</code>. A new deploy creates another
                            id; the first stays listed below.
                          </p>
                          <div className="section__row">
                            <button
                              className="btn btn--secondary"
                              type="button"
                              onClick={() => setConfirmRedeploy(false)}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn--primary"
                              type="button"
                              onClick={handleDeploy}
                              disabled={loading === "deploy" || !wasmFile}
                            >
                              {loading === "deploy" ? (
                                <>
                                  <Spinner /> Deploying…
                                </>
                              ) : (
                                "Confirm deploy"
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {deployError && (
                    <div className="info-box info-box--warning">
                      <span className="eyebrow">Deploy failed</span>
                      <p className="muted">{deployError.message}</p>
                      {deployError.contractId && (
                        <p className="muted">
                          Install succeeded with id <code>{deployError.contractId}</code>,
                          but <code>init</code> did not complete.
                        </p>
                      )}
                    </div>
                  )}
                  {sessionContractId && (
                    <div className="info-box">
                      <span className="eyebrow">Deployed this session</span>
                      <code>{sessionContractId}</code>
                      <div className="section__row">
                        <button
                          className="btn btn--secondary btn--sm"
                          type="button"
                          onClick={() => copyContractId(sessionContractId)}
                        >
                          Copy id
                        </button>
                        <span className="muted">Active for Lab reads &amp; register</span>
                      </div>
                      <p className="muted">
                        Set{" "}
                        <code>KITEWELL_CONTRACT_ID={sessionContractId}</code> on the
                        backend to persist it. This panel does not write backend env vars.
                      </p>
                      {deployedContracts.length > 1 && (
                        <div className="metadata-grid">
                          {deployedContracts.map((entry, index) => (
                            <div key={`${entry.contractId}-${index}`}>
                              <span className="metadata-label">
                                Deploy #{index + 1}
                                {entry.contractId === sessionContractId
                                  ? " · active"
                                  : ""}
                              </span>
                              <code>{entry.contractId}</code>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="section__row">
                    <div className="subhead">On-chain registry</div>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={refreshLabState}
                      disabled={loading === "labstate" || !rpcHealth.ok}
                    >
                      {loading === "labstate" ? (
                        <>
                          <Spinner /> Reading…
                        </>
                      ) : (
                        "Refresh"
                      )}
                    </button>
                  </div>
                  <p className="muted" role="status">
                    Contract instance: {contractStatusLabel(contractStatus)}
                  </p>
                  {contractCallBlock && (
                    <div className="info-box info-box--warning">
                      <p className="muted">{contractCallBlock}</p>
                    </div>
                  )}
                  {labState ? (
                    <div className="info-box">
                      <span className="eyebrow">Contract state</span>
                      <div className="metadata-grid">
                        <div>
                          <span className="metadata-label">lab_name</span>
                          <span className="metadata-value">{labState.labName ?? "—"}</span>
                        </div>
                        <div>
                          <span className="metadata-label">builder_count</span>
                          <span className="metadata-value">{labState.builderCount ?? 0}</span>
                        </div>
                        <div>
                          <span className="metadata-label">get_builder (you)</span>
                          <span className="metadata-value">
                            {publicKey ? labState.builder ?? "Not registered" : "Connect to check"}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">paused</span>
                          <span className="metadata-value">
                            {labState.paused ? "Yes — registration paused" : "No"}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">get_admin</span>
                          <span className="metadata-value">
                            {labState.admin ? shortenAddress(labState.admin) : "Not set"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="muted">
                      Reads lab_name, builder_count, and get_builder via Soroban RPC.
                    </p>
                  )}
                  <LabAdminPanel
                    adminState={adminState}
                    publicKey={publicKey}
                    proposeAdminForm={proposeAdminForm}
                    setProposeAdminForm={setProposeAdminForm}
                    onProposeAdmin={handleProposeAdmin}
                    onAcceptAdmin={handleAcceptAdmin}
                    loading={loading}
                    Spinner={Spinner}
                  />
                  {labStateError && (
                    <div className="info-box info-box--warning">
                      <span className="eyebrow">Contract state</span>
                      <p className="muted">{labStateError}</p>
                    </div>
                  )}

                  <div className="section__row">
                    <div className="subhead">Registered builders</div>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={() => loadBuilderPage(0)}
                      disabled={!configuredContractId || loading === "builders"}
                    >
                      {loading === "builders" ? (
                        <>
                          <Spinner /> Reading…
                        </>
                      ) : (
                        "Refresh"
                      )}
                    </button>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      disabled={!builderList}
                      onClick={() =>
                        downloadCsv(buildersToCsv(builderList?.rows), "builders.csv")
                      }
                      title="Download the builder page currently loaded"
                    >
                      Download CSV
                    </button>
                  </div>
                  {!builderList && (
                    <p className="muted">Load the builder registry to export it.</p>
                  )}
                  {builderList && builderList.rows.length === 0 && (
                    <p className="muted">
                      No builders on this page — the export will contain only the header.
                    </p>
                  )}
                  {!configuredContractId && (
                    <p className="muted">
                      No contract id configured — no builders to list.
                    </p>
                  )}
                  {builderListError && (
                    <div className="info-box info-box--warning">
                      <p className="muted">{builderListError}</p>
                    </div>
                  )}
                  {builderList && configuredContractId && (
                    <>
                      <p className="muted">
                        Loaded {builderList.rows.length} / builder_count{" "}
                        {labState?.builderCount ?? "unavailable"}
                      </p>
                      {isBuilderCountMismatch(
                        builderList.rows.length,
                        labState?.builderCount,
                        builderList.nextStart
                      ) && (
                        <div className="info-box info-box--warning">
                          <p className="muted">
                            Count mismatch: loaded {builderList.rows.length} builders,
                            but the contract reports {labState.builderCount}.
                          </p>
                        </div>
                      )}
                      {builderList.rows.length > 0 ? (
                        <ul className="balance-list">
                          {builderList.rows.map((row) => (
                            <li key={row.address} className="balance-row">
                              <div>
                                <strong>{row.name ?? "—"}</strong>
                                <span className="muted balance-row__issuer">
                                  {shortenAddress(row.address)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">
                          {builderList.start > 0
                            ? "Empty page — no more builders."
                            : "No builders registered yet."}
                        </p>
                      )}
                      {builderList.nextStart !== null && (
                        <div className="section__row">
                          <button
                            className="btn btn--secondary btn--sm"
                            type="button"
                            disabled={loading === "builders"}
                            onClick={() =>
                              loadBuilderPage(
                                builderList.nextStart,
                                undefined,
                                true
                              )
                            }
                          >
                            Load next page
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  <form className="form" onSubmit={handleBuilderLookup}>
                    <div className="subhead">Builder lookup</div>
                    <label className="label" htmlFor="builder-lookup-address">
                      Stellar address
                    </label>
                    <input
                      id="builder-lookup-address"
                      className="input"
                      type="text"
                      maxLength={56}
                      placeholder="G…"
                      value={builderAddress}
                      onChange={(e) => setBuilderAddress(e.target.value)}
                    />
                    <button
                      className="btn btn--secondary"
                      type="submit"
                      disabled={loading === "builder-lookup"}
                    >
                      {loading === "builder-lookup" ? (
                        <>
                          <Spinner /> Looking up…
                        </>
                      ) : (
                        "Look up builder"
                      )}
                    </button>
                  </form>
                  {builderLookupError && (
                    <div className="info-box info-box--warning">
                      <p className="muted">{builderLookupError}</p>
                    </div>
                  )}
                  {builderLookupResult && (
                    <div className="info-box">
                      <span className="eyebrow">Builder</span>
                      {builderLookupResult.registered ? (
                        <code>{builderLookupResult.name}</code>
                      ) : (
                        <span className="muted">Not registered</span>
                      )}
                    </div>
                  )}

                  <form className="form" onSubmit={handleRegister}>
                    <label className="label" htmlFor="builder-name">
                      Builder name
                    </label>
                    <input
                      id="builder-name"
                      className="input"
                      maxLength={64}
                      placeholder="e.g. stellar-alice"
                      value={registerForm.name}
                      onChange={(e) => {
                        setRegisterForm({ ...registerForm, name: e.target.value });
                        setSimulationFees(null);
                        setSimulatedRegisterKey(null);
                      }}
                    />
                    <button
                      className="btn btn--primary"
                      type="submit"
                      disabled={
                        loading === "register" ||
                        loading === "simulate" ||
                        requireWallet ||
                        !registerSimulationReady ||
                        !canCallContract(contractStatus)
                      }
                    >
                      {loading === "register" ? (
                        <>
                          <Spinner /> Signing in Freighter…
                        </>
                      ) : (
                        "Sign & register"
                      )}
                    </button>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={handleSimulateRegister}
                      disabled={
                        loading === "simulate" ||
                        loading === "register" ||
                        requireWallet ||
                        !canCallContract(contractStatus)
                      }
                    >
                      {loading === "simulate" ? (
                        <>
                          <Spinner /> Simulating…
                        </>
                      ) : (
                        "Simulate register"
                      )}
                    </button>
                    {!publicKey && <p className="muted">Connect Freighter to sign.</p>}
                  </form>
                  {simulationFees && (
                    <div className="info-box">
                      <span className="eyebrow">Simulated fees (stroops)</span>
                      {simulationFees.error ? (
                        <p className="muted">
                          Simulation failed: {simulationFees.error}
                        </p>
                      ) : (
                        <>
                          <div className="metadata-grid">
                            <div>
                              <span className="metadata-label">Return value</span>
                              <span className="metadata-value">
                                {formatArgumentValue(simulationFees.returnValue)}
                              </span>
                            </div>
                            <div>
                              <span className="metadata-label">Inclusion fee</span>
                              <span className="metadata-value">
                                {formatSimulationFee(simulationFees.inclusionFee)}
                              </span>
                            </div>
                            <div>
                              <span className="metadata-label">Resource fee</span>
                              <span className="metadata-value">
                                {formatSimulationFee(simulationFees.resourceFee)}
                              </span>
                            </div>
                            <div>
                              <span className="metadata-label">Total fee</span>
                              <span className="metadata-value">
                                {formatSimulationFee(simulationFees.totalFee)}
                              </span>
                            </div>
                          </div>
                          <p className="muted">
                            Simulation does not submit. Press Sign &amp; register to sign
                            and submit this invocation.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {lastRegisterTx && (
                    <div className="info-box">
                      <span className="eyebrow">Register tx</span>
                      <code>{lastRegisterTx.hash}</code>
                      <a
                        href={explorerTxUrl(lastRegisterTx.hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                      >
                        Explorer ↗
                      </a>
                    </div>
                  )}

                  <div className="subhead">Sponsor a new account</div>
                  <p className="muted">
                    Creates the account and its reserve in one transaction:
                    begin sponsoring, create the account with a starting balance of 0,
                    then end sponsoring. The new key signs too, so both signatures are
                    collected before submit.
                  </p>
                  <form className="form" onSubmit={handleSponsorAccount}>
                    <label className="label" htmlFor="sponsor-new-account">
                      New account public key
                    </label>
                    <input
                      id="sponsor-new-account"
                      className="input"
                      type="text"
                      placeholder="G…"
                      value={sponsorForm.newAccount}
                      onChange={(e) => {
                        setSponsorForm({
                          ...sponsorForm,
                          newAccount: e.target.value,
                        });
                        setSponsorDraft(null);
                      }}
                      required
                    />
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={handleBuildSponsorDraft}
                      disabled={loading === "sponsor-draft" || requireWallet}
                    >
                      {loading === "sponsor-draft" ? (
                        <>
                          <Spinner /> Building…
                        </>
                      ) : (
                        "Build unsigned envelope"
                      )}
                    </button>
                    {sponsorDraft && (
                      <div className="info-box">
                        <span className="eyebrow">Unsigned envelope</span>
                        <p className="muted">
                          Have the new account sign this exact XDR, then paste the
                          signed XDR below. Nothing has been submitted yet.
                        </p>
                        <textarea
                          className="input"
                          rows={4}
                          readOnly
                          spellCheck={false}
                          value={sponsorDraft.xdr}
                          onFocus={(e) => e.target.select()}
                        />
                        <p className="muted">Hash {sponsorDraft.hash}</p>
                      </div>
                    )}
                    <label className="label" htmlFor="sponsor-cosigned-xdr">
                      Co-signed envelope (base64 XDR)
                    </label>
                    <textarea
                      id="sponsor-cosigned-xdr"
                      className="input"
                      rows={4}
                      spellCheck={false}
                      placeholder="Paste the XDR signed by the new account"
                      value={sponsorForm.coSignedXdr}
                      onChange={(e) =>
                        setSponsorForm({
                          ...sponsorForm,
                          coSignedXdr: e.target.value,
                        })
                      }
                    />
                    <p className="muted">
                      {sponsorForm.coSignedXdr.trim()
                        ? "The sponsor signs this co-signed envelope in Freighter before it is sent."
                        : "A missing second signature is never submitted."}
                    </p>
                    <button
                      className="btn btn--primary"
                      type="submit"
                      disabled={
                        loading === "sponsor" ||
                        requireWallet ||
                        !sponsorForm.newAccount.trim() ||
                        !sponsorForm.coSignedXdr.trim()
                      }
                    >
                      {loading === "sponsor" ? (
                        <>
                          <Spinner /> Signing in Freighter…
                        </>
                      ) : (
                        "Sign as sponsor & submit"
                      )}
                    </button>
                  </form>
                  {sponsorResult && (
                    <div className="info-box">
                      <span className="eyebrow">Sponsored account</span>
                      <p className="muted">
                        New account id: {sponsorResult.newAccount}
                      </p>
                      <code>{sponsorResult.hash}</code>
                      <a
                        href={explorerTxUrl(sponsorResult.hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                      >
                        Explorer ↗
                      </a>
                    </div>
                  )}

                  <div className="subhead">End a sponsorship</div>
                  <p className="muted">
                    Ends one entry from the sponsorship list with a single
                    revoke-sponsorship operation. Nothing is signed until the
                    confirmation below is accepted.
                  </p>
                  <form className="form" onSubmit={handleReviewEndSponsorship}>
                    <label className="label" htmlFor="end-sponsor-account">
                      Sponsored account
                    </label>
                    <input
                      id="end-sponsor-account"
                      className="input"
                      type="text"
                      placeholder="G…"
                      value={endSponsorForm.sponsoredAccount}
                      onChange={(e) => {
                        setEndSponsorForm({
                          ...endSponsorForm,
                          sponsoredAccount: e.target.value,
                        });
                        setEndSponsorConfirmation(null);
                      }}
                    />
                    <label className="label" htmlFor="end-sponsor-code">
                      Asset code
                    </label>
                    <input
                      id="end-sponsor-code"
                      className="input"
                      type="text"
                      placeholder="USDC"
                      maxLength={12}
                      value={endSponsorForm.assetCode}
                      onChange={(e) => {
                        setEndSponsorForm({
                          ...endSponsorForm,
                          assetCode: e.target.value,
                        });
                        setEndSponsorConfirmation(null);
                      }}
                    />
                    <label className="label" htmlFor="end-sponsor-issuer">
                      Asset issuer
                    </label>
                    <input
                      id="end-sponsor-issuer"
                      className="input"
                      type="text"
                      placeholder="G…"
                      value={endSponsorForm.assetIssuer}
                      onChange={(e) => {
                        setEndSponsorForm({
                          ...endSponsorForm,
                          assetIssuer: e.target.value,
                        });
                        setEndSponsorConfirmation(null);
                      }}
                    />
                    <button
                      className="btn btn--secondary"
                      type="submit"
                      disabled={
                        loading === "end-sponsorship" ||
                        requireWallet ||
                        !hasEndSponsorshipAction({
                          entryType: "trustline",
                          ...endSponsorForm,
                        })
                      }
                    >
                      Review
                    </button>
                  </form>
                  {endSponsorConfirmation && (
                    <div className="info-box info-box--warning">
                      <span className="eyebrow">Confirm end sponsorship</span>
                      <p className="muted">{endSponsorConfirmation.message}</p>
                      <div className="metadata-grid">
                        <div>
                          <span className="metadata-label">
                            Sponsored account
                          </span>
                          <span className="metadata-value">
                            {endSponsorConfirmation.sponsoredAccount}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">Entry</span>
                          <span className="metadata-value">
                            {endSponsorConfirmation.entryLabel}
                          </span>
                        </div>
                      </div>
                      <div className="section__row">
                        <button
                          className="btn btn--secondary"
                          type="button"
                          onClick={() => setEndSponsorConfirmation(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn--primary"
                          type="button"
                          onClick={handleEndSponsorship}
                          disabled={loading === "end-sponsorship"}
                        >
                          {loading === "end-sponsorship" ? (
                            <>
                              <Spinner /> Signing in Freighter…
                            </>
                          ) : (
                            "Sign & end sponsorship"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {endSponsorResult && (
                    <div className="info-box">
                      <span className="eyebrow">Sponsorship ended</span>
                      <p className="muted">
                        {endSponsorResult.entryLabel} held by{" "}
                        {endSponsorResult.sponsoredAccount}
                      </p>
                      <code>{endSponsorResult.hash}</code>
                      <a
                        href={explorerTxUrl(endSponsorResult.hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link"
                      >
                        Explorer ↗
                      </a>
                    </div>
                  )}

                  <div className="section__row">
                    <div className="subhead">Contract instance TTL</div>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={() => refreshTtlInfo()}
                      disabled={loading === "ttl" || !configuredContractId}
                    >
                      {loading === "ttl" ? (
                        <>
                          <Spinner /> Reading…
                        </>
                      ) : (
                        "Refresh"
                      )}
                    </button>
                  </div>
                  {!configuredContractId && (
                    <p className="muted">
                      No contract id configured — set one in the backend to read
                      or extend its TTL.
                    </p>
                  )}
                  {ttlError && (
                    <div className="info-box info-box--warning">
                      <span className="eyebrow">Soroban RPC</span>
                      <p className="muted">{ttlError}</p>
                    </div>
                  )}
                  {ttlInfo && (
                    <div className="info-box">
                      <span className="eyebrow">Instance lifetime</span>
                      <div className="metadata-grid">
                        <div>
                          <span className="metadata-label">Latest ledger</span>
                          <span className="metadata-value">
                            {ttlInfo.latestLedger}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">Expires at ledger</span>
                          <span className="metadata-value">
                            {ttlInfo.liveUntilLedgerSeq ?? "—"}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">
                            Ledgers remaining
                          </span>
                          <span className="metadata-value">
                            {ttlInfo.ledgersRemaining}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <form className="form" onSubmit={handleExtendTtl}>
                    <label className="label" htmlFor="ttl-deadline">
                      Extend to ledger
                    </label>
                    <input
                      id="ttl-deadline"
                      className="input"
                      type="number"
                      min="0"
                      step="1"
                      value={ttlForm.extendTo}
                      onChange={(e) =>
                        setTtlForm({ extendTo: e.target.value })
                      }
                      disabled={!ttlInfo}
                    />
                    <p className="muted">
                      Must be later than the current deadline. This sends only
                      an <code>extendFootprintTtl</code> op — never register,
                      pause, or unregister.
                    </p>
                    <button
                      className="btn btn--primary"
                      type="submit"
                      disabled={
                        loading === "ttl-extend" ||
                        requireWallet ||
                        !configuredContractId ||
                        !ttlInfo ||
                        !ttlForm.extendTo
                      }
                    >
                      {loading === "ttl-extend" ? (
                        <>
                          <Spinner /> Signing in Freighter…
                        </>
                      ) : (
                        "Extend TTL"
                      )}
                    </button>
                  </form>
                  {ttlResult && (
                    <div className="info-box">
                      <span className="eyebrow">New deadline</span>
                      <code>
                        Ledger {ttlResult.liveUntilLedgerSeq} ·{" "}
                        {ttlResult.hash}
                      </code>
                    </div>
                  )}

                  <div className="section__row">
                    <div className="subhead">Contract code TTL</div>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={refreshCodeTtl}
                      disabled={loading === "code-ttl" || !configuredContractId}
                    >
                      {loading === "code-ttl" ? "Reading…" : "Refresh code TTL"}
                    </button>
                  </div>
                  <p className="muted">
                    Extends the Wasm code entry on its own. The instance TTL above is left unchanged.
                  </p>
                  {codeTtlError && (
                    <div className="info-box info-box--warning">
                      <p className="muted">{codeTtlError}</p>
                    </div>
                  )}
                  {codeTtl && (
                    <div className="info-box">
                      <span className="eyebrow">Code lifetime</span>
                      <div className="metadata-grid">
                        <div>
                          <span className="metadata-label">Current ledger</span>
                          <span className="metadata-value">{codeTtl.currentLedger}</span>
                        </div>
                        <div>
                          <span className="metadata-label">Code TTL</span>
                          <span className="metadata-value">
                            {codeTtl.codeTTL ? `Ledger ${codeTtl.codeTTL}` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="metadata-label">Wasm hash</span>
                          <span className="metadata-value">
                            {codeTtl.wasmHash ? `${codeTtl.wasmHash.slice(0, 16)}…` : "—"}
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn btn--secondary btn--sm"
                        type="button"
                        onClick={handleExtendCodeTtl}
                        disabled={
                          loading === "extend-code" ||
                          !publicKey ||
                          !codeTtl.wasmHash
                        }
                      >
                        {loading === "extend-code" ? "Extending…" : "Extend code TTL"}
                      </button>
                    </div>
                  )}

                  <div className="section__row">
                    <div className="subhead">Contract event tail</div>
                    <button
                      className="btn btn--secondary"
                      type="button"
                      onClick={() => pollLabEvents(configuredContractId)}
                      disabled={!configuredContractId}
                    >
                      Refresh
                    </button>
                  </div>
                  {!configuredContractId && (
                    <p className="muted">
                      No contract id configured — no events to show.
                    </p>
                  )}
                  {labEventsError && (
                    <div className="info-box info-box--warning">
                      <p className="muted">{labEventsError}</p>
                    </div>
                  )}
                  {labEvents.length > 0 ? (
                    <ul className="balance-list">
                      {labEvents.map((event) => (
                        <li key={event.id} className="balance-row">
                          <div>
                            <strong>{event.functionName ?? "unknown"}</strong>
                            <span className="muted balance-row__issuer">
                              ledger {event.ledger}
                            </span>
                          </div>
                          <div className="muted contract-event-detail">
                            {event.type === "register"
                              ? `${event.name ?? "—"} · ${event.caller} · ${
                                  event.isNew ? "new builder" : "existing"
                                }`
                              : event.type === "paused"
                                ? `paused = ${String(event.paused)}`
                                : `topics: ${event.topics.join(" · ")}`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    !labEventsError && (
                      <p className="muted">
                        No contract events since this tab opened.
                      </p>
                    )
                  )}

                  <div className="subhead">Replay from a ledger</div>
                  <p className="muted">
                    A one-shot read of register and pause events from a start ledger,
                    up to 200 at a time. The live tail above is left alone.
                  </p>
                  <form className="form" onSubmit={handleReplayEvents}>
                    <label className="label" htmlFor="replay-start-ledger">
                      Start ledger
                    </label>
                    <input
                      id="replay-start-ledger"
                      className="input"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 1234567"
                      value={replayForm}
                      onChange={(e) => setReplayForm(e.target.value)}
                      required
                    />
                    <button
                      className="btn btn--primary"
                      type="submit"
                      disabled={loading === "replay" || !configuredContractId}
                    >
                      {loading === "replay" ? (
                        <>
                          <Spinner /> Reading…
                        </>
                      ) : (
                        "Replay events"
                      )}
                    </button>
                  </form>
                  {replayError && (
                    <div className="info-box info-box--warning">
                      <p className="muted">{replayError}</p>
                    </div>
                  )}
                  {replayEvents.length > 0 && (
                    <ul className="balance-list">
                      {replayEvents.map((event) => (
                        <li key={event.id} className="balance-row">
                          <div>
                            <strong>{event.type}</strong>
                            <span className="muted balance-row__issuer">
                              ledger {event.ledger}
                            </span>
                          </div>
                          <div className="muted">
                            {event.type === "register"
                              ? `${event.name ?? "—"} · ${shortenAddress(event.caller)} · ${
                                  event.isNew ? "new builder" : "existing"
                                }`
                              : `paused = ${String(event.paused)}`}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              {/* Signers, weights, and thresholds management */}
              <div className="section" id="signers-thresholds-section">
                <div className="section__row">
                  <h2>Signer weights & thresholds</h2>
                  <p className="muted">
                    Manage account thresholds and signer weights. Weights are 0–255.
                    A weight of 0 removes a signer.
                  </p>
                </div>
                {accountDetails ? (
                  <div className="metadata-grid">
                    <div>
                      <span className="metadata-label">Current low threshold</span>
                      <span className="metadata-value">{accountDetails.thresholds?.low ?? 0}</span>
                    </div>
                    <div>
                      <span className="metadata-label">Current medium threshold</span>
                      <span className="metadata-value">{accountDetails.thresholds?.medium ?? 0}</span>
                    </div>
                    <div>
                      <span className="metadata-label">Current high threshold</span>
                      <span className="metadata-value">{accountDetails.thresholds?.high ?? 0}</span>
                    </div>
                  </div>
                ) : (
                  <p className="muted">Connect Freighter to view current thresholds.</p>
                )}
                {!accountDetails && !publicKey && (
                  <p className="muted">Connect Freighter to manage signers and thresholds.</p>
                )}
                {accountDetails && (
                  <form className="form" onSubmit={handleSetOptions}>
                    <div className="metadata-grid">
                      <div>
                        <span className="metadata-label">Low threshold</span>
                        <input
                          type="number"
                          min="0"
                          max="255"
                          step="1"
                          value={lowThreshold}
                          onChange={(e) => setLowThreshold(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <span className="metadata-label">Medium threshold</span>
                        <input
                          type="number"
                          min="0"
                          max="255"
                          step="1"
                          value={medThreshold}
                          onChange={(e) => setMedThreshold(Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <span className="metadata-label">High threshold</span>
                        <input
                          type="number"
                          min="0"
                          max="255"
                          step="1"
                          value={highThreshold}
                          onChange={(e) => setHighThreshold(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="section__row">
                      <span className="metadata-label">Signers</span>
                      <span className="metadata-value">{signers.length}</span>
                    </div>
                    {signers.length > 0 && (
                      <ul className="signer-list">
                        {signers.map((signer, index) => (
                          <li key={signer} className="signer-row">
                            <span className="signer-address">{signer}</span>
                            <span className="signer-weight">
                              <input
                                type="number"
                                min="0"
                                max="255"
                                step="1"
                                value={signerWeights[index] ?? 0}
                                onChange={(e) => handleSignerWeightChange(index, Number(e.target.value))}
                              />
                            </span>
                            <button
                              className="btn btn--secondary btn--sm"
                              type="button"
                              onClick={() => handleRemoveSigner(index)}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {signers.length < 4 && (
                      <div className="section__row">
                        <span className="metadata-label">Add signer</span>
                        <input
                          type="text"
                          placeholder="Signer public key (G...)"
                          onChange={(e) => handleAddSigner(e.target.value)}
                        />
                        <button
                          className="btn btn--primary"
                          type="button"
                          onClick={() => handleAddSigner(signerInput)}
                          disabled={!signerInput}
                        >
                          Add
                        </button>
                      </div>
                    )}
                    <div className="section__row">
                      <button
                        className="btn btn--primary"
                        type="submit"
                        disabled={loading === "setoptions" || requireWallet}
                      >
                        {loading === "setoptions" ? (
                          <>
                            <Spinner /> Signing in Freighter…
                          </>
                        ) : (
                          "Submit setOptions"
                        )}
                      </button>
                    </div>
                  </form>
                )}
                {accountDetails && (
                  <div className="warning-box">
                    <span className="eyebrow">Warning</span>
                    <p className="muted">
                      {medThreshold > (signers.reduce((sum, signer) => sum + (signerWeights[signers.indexOf(signer)] ?? 0), 0) || 0)
                        ? "Medium threshold exceeds total signer weights."
                        : "Thresholds are covered by the current signer weights."}
                    </p>
                  </div>
                )}
              </div>
              <MultisigCosignPanel publicKey={publicKey} onToast={showToast} />
              {!labInfo && !labError && (
                <p className="muted">Open this tab to probe the backend.</p>
              )}
              <div className="info-box">
                <span className="eyebrow">Failed submits</span>
                <p className="muted">
                  {failedSubmits.length === 0
                    ? "No failed submits this session yet."
                    : `${failedSubmits.length} failed submission${
                        failedSubmits.length === 1 ? "" : "s"
                      } this session. Cleared on disconnect or reload — not stored in localStorage.`}
                </p>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={handleDownloadFailedSubmits}
                  disabled={failedSubmits.length === 0}
                >
                  Download failed JSON
                </button>
              </div>
            </div>
          )}

          {activeTab === "History" && (
            <div className="section">
              <div className="section__row">
                <h2>Payment history</h2>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={handleHistory}
                  disabled={loading === "history" || requireWallet}
                >
                  {loading === "history" ? "Loading…" : "Refresh"}
                </button>
              </div>

              {txWatchPanel}
            </div>
          )}

          {activeTab === "Liquidity" && (
            <div className="section">
              <div className="section__row">
                <h2>Liquidity Pool</h2>
                <p className="muted">
                  Deposit into or withdraw from a constant-product pool.
                </p>
              </div>
              <form className="form" onSubmit={handleLiquidity}>
                <label className="label" htmlFor="liquidity-pool-id">
                  Pool ID
                </label>
                <input
                  id="liquidity-pool-id"
                  className="input"
                  type="text"
                  maxLength={64}
                  pattern="[0-9a-fA-F]{64}"
                  placeholder="64 hexadecimal characters"
                  value={liquidityForm.poolId}
                  onChange={(e) =>
                    setLiquidityForm({
                      ...liquidityForm,
                      poolId: e.target.value,
                    })
                  }
                  required
                />
                <label className="label" htmlFor="liquidity-mode">
                  Operation
                </label>
                <select
                  id="liquidity-mode"
                  className="input"
                  value={liquidityForm.mode}
                  onChange={(e) =>
                    setLiquidityForm({
                      ...liquidityForm,
                      mode: e.target.value,
                    })
                  }
                >
                  <option value="deposit">Deposit</option>
                  <option value="withdraw">Withdraw</option>
                </select>

                {liquidityForm.mode === "deposit" ? (
                  <>
                    <p className="muted">
                      Reserve A/B amounts follow the order returned by Horizon.
                    </p>
                    <label className="label" htmlFor="liquidity-max-amount-a">
                      Maximum amount A
                    </label>
                    <input
                      id="liquidity-max-amount-a"
                      className="input"
                      type="number"
                      min="0.0000001"
                      step="0.0000001"
                      value={liquidityForm.maxAmountA}
                      onChange={(e) =>
                        setLiquidityForm({
                          ...liquidityForm,
                          maxAmountA: e.target.value,
                        })
                      }
                      required
                    />
                    <label className="label" htmlFor="liquidity-max-amount-b">
                      Maximum amount B
                    </label>
                    <input
                      id="liquidity-max-amount-b"
                      className="input"
                      type="number"
                      min="0.0000001"
                      step="0.0000001"
                      value={liquidityForm.maxAmountB}
                      onChange={(e) =>
                        setLiquidityForm({
                          ...liquidityForm,
                          maxAmountB: e.target.value,
                        })
                      }
                      required
                    />
                    <label className="label" htmlFor="liquidity-min-price">
                      Minimum price
                    </label>
                    <input
                      id="liquidity-min-price"
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      value={liquidityForm.minPrice}
                      onChange={(e) =>
                        setLiquidityForm({
                          ...liquidityForm,
                          minPrice: e.target.value,
                        })
                      }
                      required
                    />
                    <label className="label" htmlFor="liquidity-max-price">
                      Maximum price
                    </label>
                    <input
                      id="liquidity-max-price"
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      value={liquidityForm.maxPrice}
                      onChange={(e) =>
                        setLiquidityForm({
                          ...liquidityForm,
                          maxPrice: e.target.value,
                        })
                      }
                      required
                    />
                  </>
                ) : (
                  <>
                    <label className="label" htmlFor="liquidity-share-amount">
                      Pool shares to withdraw
                    </label>
                    <input
                      id="liquidity-share-amount"
                      className="input"
                      type="number"
                      min="0.0000001"
                      step="0.0000001"
                      value={liquidityForm.amount}
                      onChange={(e) =>
                        setLiquidityForm({
                          ...liquidityForm,
                          amount: e.target.value,
                        })
                      }
                      required
                    />
                    <label className="label" htmlFor="liquidity-min-amount-a">
                      Minimum amount A out
                    </label>
                    <input
                      id="liquidity-min-amount-a"
                      className="input"
                      type="number"
                      min="0.0000001"
                      step="0.0000001"
                      value={liquidityForm.minAmountA}
                      onChange={(e) =>
                        setLiquidityForm({
                          ...liquidityForm,
                          minAmountA: e.target.value,
                        })
                      }
                      required
                    />
                    <label className="label" htmlFor="liquidity-min-amount-b">
                      Minimum amount B out
                    </label>
                    <input
                      id="liquidity-min-amount-b"
                      className="input"
                      type="number"
                      min="0.0000001"
                      step="0.0000001"
                      value={liquidityForm.minAmountB}
                      onChange={(e) =>
                        setLiquidityForm({
                          ...liquidityForm,
                          minAmountB: e.target.value,
                        })
                      }
                      required
                    />
                  </>
                )}
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={loading === "liquidity"}
                >
                  {loading === "liquidity" ? (
                    <>
                      <Spinner /> Submitting…
                    </>
                  ) : (
                    "Sign and submit"
                  )}
                </button>
              </form>
            </div>
          )}

          {activeTab === "History" && (
            <div className="section">
              <div className="section__row">
                <h2>Payment history</h2>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={handleHistory}
                  disabled={loading.startsWith("history") || requireWallet}
                >
                  {loading === "history" ? (
                    <>
                      <Spinner /> Loading…
                    </>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
              <p className="muted" aria-live="polite">
                {streamStatusLabel(streamState)}
              </p>
              {historyError && (
                <div className="info-box info-box--warning" role="alert">
                  <p className="muted">{historyError}</p>
                </div>
              )}
              <div className="section__row">
                <label className="label">
                  Asset
                  <select
                    className="input"
                    aria-label="Filter payment history by asset"
                    value={historyFilters.asset}
                    onChange={(event) =>
                      setHistoryFilters((previous) => ({
                        ...previous,
                        asset: event.target.value,
                      }))
                    }
                  >
                    <option value="">All assets</option>
                    {historyAssets.map((asset) => (
                      <option key={asset} value={asset}>
                        {asset}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="label">
                  Direction
                  <select
                    className="input"
                    aria-label="Filter payment history by direction"
                    value={historyFilters.direction}
                    onChange={(event) =>
                      setHistoryFilters((previous) => ({
                        ...previous,
                        direction: event.target.value,
                      }))
                    }
                  >
                    <option value="">Sent and received</option>
                    <option value="sent">Sent</option>
                    <option value="received">Received</option>
                  </select>
                </label>
              </div>
              <p className="muted">
                Current cursor: <code>{currentHistoryCursor || "first page"}</code>
              </p>
              {filteredTransactions.length > 0 ? (
                <div className="tx-list">
                  {filteredTransactions.map((tx) => {
                    const isOutgoing = tx.from === publicKey;
                    const createdAt = formatCreatedAt(tx.created_at);
                    const memo = mapPaymentMemo(tx);
                    return (
                      <div
                        key={tx.id}
                        className={`tx-item tx-item--selectable ${isOutgoing ? "tx-item--out" : "tx-item--in"}`}
                        onClick={() => setSelectedTxHash(tx.transaction_hash)}
                      >
                        <div className="tx-item__direction">
                          {isOutgoing ? "Sent" : "Received"}
                          <button
                            className="tx-item__details-btn"
                            type="button"
                            aria-pressed={selectedTxHash === tx.transaction_hash}
                          >
                            Details
                          </button>
                        </div>
                        <div className="tx-item__amount">
                          {parseFloat(tx.amount).toLocaleString()} {tx.asset_code || "XLM"}
                        </div>
                        <div className="tx-item__addr muted">
                          {isOutgoing
                            ? `To ${shortenAddress(tx.to)}`
                            : `From ${shortenAddress(tx.from)}`}
                        </div>
                        <a
                          href={explorerTxUrl(tx.transaction_hash)}
                          target="_blank"
                          rel="noreferrer"
                          className="tx-item__link"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Explorer ↗
                        </a>
                        <div className="tx-item__fee muted">
                          {formatHistoryFee(tx)}
                        </div>
                        <div className="tx-item__memo">
                          <span className="metadata-label">{memo.label}</span>
                          <span className="tx-item__memo-value">{memo.value}</span>
                        </div>
                        {createdAt && (
                          <time
                            className="tx-item__time"
                            dateTime={tx.created_at}
                          >
                            {createdAt}
                          </time>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !loading && (
                  <p className="muted">
                    {visibleTransactions.length > 0
                      ? "No payments match these filters."
                      : "No payments yet."}
                  </p>
                )
              )}
              <div className="section__row">
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={handleLoadPrevious}
                  disabled={pageCursors.length < 2 || loading.startsWith("history")}
                >
                  {loading === "history-previous" ? (
                    <>
                      <Spinner /> Loading…
                    </>
                  ) : (
                    "Previous page"
                  )}
                </button>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={handleLoadNext}
                  disabled={!nextCursor || loading.startsWith("history")}
                >
                  {loading === "history-next" ? (
                    <>
                      <Spinner /> Loading…
                    </>
                  ) : (
                    "Next page"
                  )}
                </button>
              </div>

              {txWatchPanel}
            </div>
          )}

          {activeTab === "Issuer" && (
            <div className="section">
              <h2>Issuer stellar.toml</h2>
              <p className="muted">
                An issuer account is looked up for the home domain it publishes, then that
                domain&apos;s stellar.toml is read over HTTPS only. A file that does not parse
                shows the failure and no rows.
              </p>

              <form className="form" onSubmit={handleIssuerLookup}>
                <label className="label" htmlFor="issuer-account-or-domain">
                  Issuer account or home domain
                </label>
                <input
                  id="issuer-account-or-domain"
                  className="input"
                  type="text"
                  placeholder="G… or example.org"
                  value={issuerInput}
                  onChange={(e) => setIssuerInput(e.target.value)}
                  required
                />
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={loading === "issuer"}
                >
                  {loading === "issuer" ? (
                    <>
                      <Spinner /> Reading…
                    </>
                  ) : (
                    "Read stellar.toml"
                  )}
                </button>
              </form>

              {issuerError && (
                <div className="info-box info-box--warning">
                  <span className="eyebrow">stellar.toml</span>
                  <p className="muted">{issuerError}</p>
                </div>
              )}

              {issuerResult && (
                <>
                  <div className="info-box">
                    <span className="eyebrow">
                      Published by {issuerResult.homeDomain}
                    </span>
                    <p className="muted">
                      Organisation: {issuerResult.orgName ?? "not published"}
                    </p>
                    {issuerResult.account && (
                      <a
                        className="text-link"
                        href={explorerAccountUrl(issuerResult.account)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Issuer account on explorer ↗
                      </a>
                    )}
                  </div>

                  <div className="subhead">DOCUMENTATION</div>
                  {Object.keys(issuerResult.documentation ?? {}).length > 0 ? (
                    <div className="metadata-grid">
                      {Object.entries(issuerResult.documentation).map(([key, value]) => (
                        <div key={key}>
                          <span className="metadata-label">{key}</span>
                          <span className="metadata-value">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No DOCUMENTATION table is published.</p>
                  )}

                  <div className="subhead">Currencies</div>
                  {issuerResult.rows.length > 0 ? (
                    <ul className="balance-list">
                      {issuerResult.rows.map((row, index) => (
                        <li
                          key={`${row.code ?? "unspecified"}-${index}`}
                          className="balance-row"
                        >
                          <div>
                            <strong>{row.code ?? "code not published"}</strong>
                            {row.issuer && (
                              <span className="muted balance-row__issuer">
                                {shortenAddress(row.issuer)}
                              </span>
                            )}
                          </div>
                          <div className="balance-row__actions">
                            <span>
                              display decimals {row.displayDecimals ?? "not published"}
                            </span>
                            {row.issuer && (
                              <a
                                className="text-link"
                                href={explorerAccountUrl(row.issuer)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Explorer ↗
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No CURRENCIES rows are published.</p>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "Web auth" && (
            <div className="section">
              <h2>Web authentication</h2>
              <p className="muted">
                Ask an anchor for a sign-in challenge, check it, sign it in Freighter, and show
                what the returned session says. The session lives in this panel only — it is
                never stored.
              </p>

              <form className="form" onSubmit={handleWebAuth}>
                <label className="label" htmlFor="webauth-endpoint">
                  Web-auth endpoint
                </label>
                <input
                  id="webauth-endpoint"
                  className="input"
                  type="text"
                  placeholder="https://auth.example.org/auth"
                  value={webAuthForm.endpoint}
                  onChange={(e) =>
                    setWebAuthForm({ ...webAuthForm, endpoint: e.target.value })
                  }
                  required
                />
                <label className="label" htmlFor="webauth-server-account">
                  Endpoint&apos;s server account
                </label>
                <input
                  id="webauth-server-account"
                  className="input"
                  type="text"
                  placeholder="G…"
                  value={webAuthForm.serverAccount}
                  onChange={(e) =>
                    setWebAuthForm({ ...webAuthForm, serverAccount: e.target.value })
                  }
                  required
                />
                <p className="muted">
                  A challenge whose source account is not this one is refused before anything is
                  signed, and so is one that has already expired.
                </p>
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={loading === "webauth" || requireWallet}
                >
                  {loading === "webauth" ? (
                    <>
                      <Spinner /> Signing in Freighter…
                    </>
                  ) : (
                    "Request & sign challenge"
                  )}
                </button>
                {requireWallet && <p className="muted">Connect Freighter to sign.</p>}
              </form>

              {webAuthError && (
                <div className="info-box info-box--warning">
                  <span className="eyebrow">Web authentication</span>
                  <p className="muted">{webAuthError}</p>
                </div>
              )}

              {webAuthResult && (
                <div className="info-box" role="status" aria-live="polite">
                  <span className="eyebrow">Signed challenge</span>
                  <div className="metadata-grid">
                    <div>
                      <span className="metadata-label">Server</span>
                      <span className="metadata-value">
                        {shortenAddress(webAuthResult.serverAccount)}
                      </span>
                    </div>
                    <div>
                      <span className="metadata-label">Operation</span>
                      <span className="metadata-value">
                        {webAuthResult.operationName} · {webAuthResult.operationCount}
                      </span>
                    </div>
                    <div>
                      <span className="metadata-label">Valid until</span>
                      <span className="metadata-value">
                        {formatCreatedAt(webAuthResult.expiresAtMs) ?? "—"}
                      </span>
                    </div>
                    <div>
                      <span className="metadata-label">Session subject</span>
                      <span className="metadata-value">
                        {shortenAddress(webAuthResult.session.subject)}
                      </span>
                    </div>
                    <div>
                      <span className="metadata-label">Session expires</span>
                      <span className="metadata-value">
                        {formatCreatedAt(webAuthResult.session.expiresAtMs) ?? "—"}
                      </span>
                    </div>
                  </div>
                  <p className="muted">
                    {webAuthResult.session.expired
                      ? "The session token has already expired."
                      : "The session token is current."}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "Decode" && (
            <div className="section">
              <h2>Decode envelope</h2>
              <p className="muted">
                Paste a signed or unsigned transaction envelope XDR. A Soroban invoke
                names its contract, function, and arguments; classic envelopes keep the
                fee, sequence, and signatures only.
              </p>
              <form onSubmit={handleDecodeEnvelope} className="form">
                <label className="label" htmlFor="envelope-xdr">
                  Envelope XDR
                </label>
                <textarea
                  id="envelope-xdr"
                  className="input"
                  rows={5}
                  placeholder="AAAAAgAAAA..."
                  value={envelopeXdr}
                  onChange={(e) => setEnvelopeXdr(e.target.value)}
                />
                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={!envelopeXdr.trim()}
                >
                  Decode
                </button>
              </form>

              {decodeError && (
                <div className="info-box info-box--warning">
                  <span className="eyebrow">Decode failed</span>
                  <p className="muted">{decodeError}</p>
                </div>
              )}

              {decodedEnvelope && (
                <div className="section">
                  <div className="info-box">
                    <span className="eyebrow">Envelope</span>
                    <div className="metadata-grid">
                      <div>
                        <span className="metadata-label">Kind</span>
                        <span className="metadata-value">
                          {decodedEnvelope.kind === "feeBump" ? "Fee bump" : "Transaction"}
                        </span>
                      </div>
                      <div>
                        <span className="metadata-label">Fee</span>
                        <span className="metadata-value">
                          {decodedEnvelope.fee} stroops
                        </span>
                      </div>
                      {decodedEnvelope.innerFee !== null && (
                        <div>
                          <span className="metadata-label">Inner fee</span>
                          <span className="metadata-value">
                            {decodedEnvelope.innerFee} stroops
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="metadata-label">Sequence</span>
                        <span className="metadata-value">{decodedEnvelope.sequence}</span>
                      </div>
                      <div>
                        <span className="metadata-label">Source</span>
                        <span className="metadata-value">
                          {shortenAddress(decodedEnvelope.source)}
                        </span>
                      </div>
                      <div>
                        <span className="metadata-label">Signatures</span>
                        <span className="metadata-value">
                          {decodedEnvelope.signatures.length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {decodedEnvelope.operations.map((operation, index) => (
                    <div key={`${operation.type}-${index}`} className="info-box">
                      <span className="eyebrow">
                        Operation {index + 1} · {operation.type}
                      </span>
                      {operation.contract && (
                        <div className="metadata-grid">
                          <div>
                            <span className="metadata-label">Contract</span>
                            <span className="metadata-value">
                              {operation.contract.address ?? "No contract address"}
                            </span>
                          </div>
                          <div>
                            <span className="metadata-label">Function</span>
                            <span className="metadata-value">
                              {operation.contract.function ?? "—"}
                            </span>
                          </div>
                          {operation.contract.args.length > 0 && (
                            <div>
                              <span className="metadata-label">Arguments</span>
                              <ul className="balance-list">
                                {operation.contract.args.map((argument, argIndex) => (
                                  <li
                                    key={`${argument.type}-${argIndex}`}
                                    className="metadata-value"
                                  >
                                    <code>{argument.type}</code>{" · "}
                                    {formatArgumentValue(argument)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                      {operation.type === "payment" && (
                        <div className="metadata-grid">
                          <div>
                            <span className="metadata-label">Destination</span>
                            <span className="metadata-value">
                              {shortenAddress(operation.destination)}
                            </span>
                          </div>
                          <div>
                            <span className="metadata-label">Asset</span>
                            <span className="metadata-value">
                              {operation.asset ?? "—"}
                            </span>
                          </div>
                          <div>
                            <span className="metadata-label">Amount</span>
                            <span className="metadata-value">{operation.amount}</span>
                          </div>
                        </div>
                      )}
                      {operation.type === "changeTrust" && (
                        <div className="metadata-grid">
                          <div>
                            <span className="metadata-label">Asset</span>
                            <span className="metadata-value">
                              {operation.asset ?? "—"}
                            </span>
                          </div>
                          <div>
                            <span className="metadata-label">Limit</span>
                            <span className="metadata-value">{operation.limit}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "Trades" && (
            <div className="section">
              <div className="section__row">
                <h2>Trade history</h2>
                <button
                  className="btn btn--secondary"
                  type="button"
                  onClick={handleTrades}
                  disabled={loading === "trades" || requireWallet}
                >
                  {loading === "trades" ? (
                    <>
                      <Spinner /> Loading…
                    </>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
              <p className="muted">
                Trades that filled offers on the decentralized exchange. This list is
                separate from payment history.
              </p>
              {trades.length > 0 ? (
                <div className="tx-list">
                  {trades.map((trade) => {
                    const isSeller = trade.base_account === publicKey;
                    const soldAsset = isSeller
                      ? trade.base_asset_code || "XLM"
                      : trade.counter_asset_code || "XLM";
                    const boughtAsset = isSeller
                      ? trade.counter_asset_code || "XLM"
                      : trade.base_asset_code || "XLM";
                    const soldAmount = isSeller ? trade.base_amount : trade.counter_amount;
                    const boughtAmount = isSeller ? trade.counter_amount : trade.base_amount;
                    const price = trade.price?.n && trade.price?.d
                      ? (parseFloat(trade.price.n) / parseFloat(trade.price.d)).toFixed(7)
                      : "—";
                    const tradeTime = formatCreatedAt(trade.ledger_close_time);

                    return (
                      <div key={trade.id} className="tx-item">
                        <div className="tx-item__direction">Trade</div>
                        <div className="tx-item__amount">
                          Sold {parseFloat(soldAmount).toLocaleString()} {soldAsset}
                        </div>
                        <div className="tx-item__amount">
                          Bought {parseFloat(boughtAmount).toLocaleString()} {boughtAsset}
                        </div>
                        <div className="tx-item__addr muted">
                          Price: {price}
                        </div>
                        {tradeTime && (
                          <time
                            className="tx-item__time"
                            dateTime={trade.ledger_close_time}
                          >
                            {tradeTime}
                          </time>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                !loading && <p className="muted">No trades yet.</p>
              )}
              {tradesNextCursor && (
                <div className="section__row">
                  <button
                    className="btn btn--secondary"
                    type="button"
                    onClick={handleLoadMoreTrades}
                    disabled={loading === "trades-more"}
                  >
                    {loading === "trades-more" ? (
                      <>
                        <Spinner /> Loading…
                      </>
                    ) : (
                      "Load more"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <strong>Kitewell</strong> · Stellar {activeNetwork.label} · Freighter ·{" "}
        <a
          href="https://github.com/Kitewell-lab/Kitewell"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}

function DecodedEnvelope({ decoded }) {
  const networkLabel = decoded.network?.label || decoded.network?.passphrase;
  const transaction = decoded.isFeeBump ? decoded.inner : decoded;

  return (
    <div className="inspect-result">
      <div className="info-box">
        <span className="eyebrow">Decoded on</span>
        <code>{networkLabel || "Selected network"}</code>
      </div>
      {decoded.isFeeBump && (
        <div className="info-box">
          <span className="eyebrow">Fee-bump · fee source</span>
          <code>{decoded.feeSource}</code>
          <p className="muted" style={{ marginTop: 6 }}>
            Outer fee: {decoded.fee} stroops
          </p>
        </div>
      )}
      <div className="subhead">
        {decoded.isFeeBump ? "Inner transaction" : "Transaction"}
      </div>
      <TransactionDetails transaction={transaction} />
    </div>
  );
}

function TransactionDetails({ transaction }) {
  const memo = transaction.memo
    ? `${transaction.memo.type}: ${transaction.memo.value}`
    : "None";
  const timeBounds = transaction.timeBounds
    ? `${transaction.timeBounds.minTime} – ${transaction.timeBounds.maxTime}`
    : "None";

  return (
    <>
      <div className="info-box">
        <div className="metadata-grid">
          <div>
            <span className="metadata-label">Source</span>
            <span className="metadata-value">{transaction.source}</span>
          </div>
          <div>
            <span className="metadata-label">Fee</span>
            <span className="metadata-value">{transaction.fee} stroops</span>
          </div>
          <div>
            <span className="metadata-label">Sequence</span>
            <span className="metadata-value">{transaction.sequence}</span>
          </div>
          <div>
            <span className="metadata-label">Memo</span>
            <span className="metadata-value">{memo}</span>
          </div>
          <div>
            <span className="metadata-label">Time bounds</span>
            <span className="metadata-value">{timeBounds}</span>
          </div>
        </div>
      </div>
      {transaction.operations.map((operation) => (
        <div className="info-box" key={operation.index}>
          <span className="eyebrow">
            Operation {operation.index + 1} · {operation.type}
          </span>
          <div className="metadata-grid">
            {operation.fields.map((field) => (
              <div key={field.key}>
                <span className="metadata-label">{field.label}</span>
                <span className="metadata-value">{field.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function tabSlug(tab) {
  return tab.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Issue #512: a payment the stream already prepended stays at the top when a
 * manual refresh re-reads it, so the paged rows drop any id the stream showed.
 */
function mergeStreamedPayments(streamed, paged) {
  const streamedIds = new Set(streamed.map((tx) => tx.id));
  return [...streamed, ...paged.filter((tx) => !streamedIds.has(tx.id))];
}

const STREAM_CLOSED_LINES = {
  disconnect: "Payments stream closed: the wallet was disconnected.",
  "network-change": "Payments stream closed: the network changed.",
  "tab-hidden": "Payments stream closed: this tab was left.",
};

/** Issue #512: what the history tab says about its own stream. */
function streamStatusLabel(state) {
  if (!state) return "New payments appear at the top of this list as they arrive.";
  if (state.failure) return state.failure;
  if (state.status === "open") return "Streaming new payments into the top of the list.";
  if (state.status === "closed") {
    return STREAM_CLOSED_LINES[state.reason] ?? "Payments stream closed.";
  }
  return "Payments stream not running.";
}

function describeComposeOperation(operation) {
  if (operation.type === "payment") {
    const asset = operation.asset?.isNative
      ? "XLM"
      : `${operation.asset?.code}:${shortenAddress(operation.asset?.issuer)}`;
    return `Payment · ${operation.amount} ${asset} to ${shortenAddress(
      operation.destination
    )}`;
  }

  if (operation.type === "changeTrust") {
    return `Change trust · ${operation.code} · limit ${operation.limit}`;
  }

  const value = operation.value ? ` = ${operation.value}` : " (delete)";
  return `Manage data · ${operation.name}${value}`;
}

function formatCreatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function KitewellMark() {
  return (
    <svg className="mark" width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <circle cx="18" cy="18" r="18" fill="#121826" />
      <circle cx="18" cy="18" r="7" fill="#F5C542" />
      <g stroke="#E8A317" strokeWidth="1.6" strokeLinecap="round">
        <path d="M18 3v4M18 29v4M3 18h4M29 18h4" />
        <path d="M7.8 7.8l2.8 2.8M25.4 25.4l2.8 2.8M7.8 28.2l2.8-2.8M25.4 10.6l2.8-2.8" />
      </g>
    </svg>
  );
}

function Spinner({ size = 16 }) {
  return (
    <svg
      className="spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
