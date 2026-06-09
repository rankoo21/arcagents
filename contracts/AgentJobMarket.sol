// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface (USDC on Arc).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @title AgentJobMarket
/// @notice An open-bidding job marketplace with USDC escrow for the AgentHire
///         dApp on Arc. It complements the ERC-8004 (identity/reputation) and
///         ERC-8183 (pre-assigned escrow) contracts by adding the missing
///         piece: open jobs that agents apply to and the client selects from.
///
/// Lifecycle:
///   postJob (USDC escrowed) -> applyForJob (many providers)
///   -> selectProvider (client) -> submit (provider, deliverable hash)
///   -> approve (client, releases USDC) | cancel (refund to client)
contract AgentJobMarket {
    // ── Types ──
    enum Status {
        Open,        // 0 - accepting applications
        Assigned,    // 1 - a provider was selected
        Submitted,   // 2 - provider submitted the deliverable
        Completed,   // 3 - client approved, funds released
        Cancelled    // 4 - client cancelled, funds refunded
    }

    struct Job {
        uint256 id;
        address client;
        address provider;     // zero until a provider is selected
        uint256 budget;       // USDC amount held in escrow (6 decimals)
        uint64  createdAt;
        uint64  deadline;     // unix timestamp; after this, client may cancel
        Status  status;
        string  description;
        bytes32 deliverable;  // hash submitted by the provider
    }

    struct Application {
        address provider;
        uint256 agentId;      // ERC-8004 token id (0 if none)
        uint256 price;        // proposed price (informational; escrow = budget)
        string  proposal;     // short pitch / link
    }

    // ── Storage ──
    IERC20 public immutable usdc;
    uint256 public nextJobId = 1;

    mapping(uint256 => Job) private _jobs;
    mapping(uint256 => Application[]) private _applications;
    // jobId => provider => has applied (prevents duplicate applications)
    mapping(uint256 => mapping(address => bool)) public hasApplied;

    // ── Events ──
    event JobPosted(
        uint256 indexed jobId,
        address indexed client,
        uint256 budget,
        uint64 deadline,
        string description
    );
    event Applied(
        uint256 indexed jobId,
        address indexed provider,
        uint256 agentId,
        uint256 price,
        string proposal
    );
    event ProviderSelected(uint256 indexed jobId, address indexed provider);
    event Submitted(uint256 indexed jobId, address indexed provider, bytes32 deliverable);
    event Completed(uint256 indexed jobId, address indexed provider, uint256 amount);
    event Cancelled(uint256 indexed jobId, address indexed client, uint256 refund);

    // ── Errors ──
    error NotClient();
    error NotProvider();
    error WrongStatus();
    error ZeroBudget();
    error AlreadyApplied();
    error NoSuchApplicant();
    error TransferFailed();
    error DeadlineNotReached();

    constructor(address usdcToken) {
        usdc = IERC20(usdcToken);
    }

    // ── Client: post a job and escrow the budget ──
    /// @dev Caller must `approve` this contract for `budget` USDC first.
    function postJob(
        string calldata description,
        uint256 budget,
        uint64 deadline
    ) external returns (uint256 jobId) {
        if (budget == 0) revert ZeroBudget();
        if (!usdc.transferFrom(msg.sender, address(this), budget)) {
            revert TransferFailed();
        }

        jobId = nextJobId++;
        Job storage j = _jobs[jobId];
        j.id = jobId;
        j.client = msg.sender;
        j.budget = budget;
        j.createdAt = uint64(block.timestamp);
        j.deadline = deadline;
        j.status = Status.Open;
        j.description = description;

        emit JobPosted(jobId, msg.sender, budget, deadline, description);
    }

    // ── Provider: apply to an open job ──
    function applyForJob(
        uint256 jobId,
        uint256 agentId,
        uint256 price,
        string calldata proposal
    ) external {
        Job storage j = _jobs[jobId];
        if (j.status != Status.Open) revert WrongStatus();
        if (msg.sender == j.client) revert NotProvider();
        if (hasApplied[jobId][msg.sender]) revert AlreadyApplied();

        hasApplied[jobId][msg.sender] = true;
        _applications[jobId].push(
            Application({
                provider: msg.sender,
                agentId: agentId,
                price: price,
                proposal: proposal
            })
        );

        emit Applied(jobId, msg.sender, agentId, price, proposal);
    }

    // ── Client: pick a provider among the applicants ──
    function selectProvider(uint256 jobId, address provider) external {
        Job storage j = _jobs[jobId];
        if (msg.sender != j.client) revert NotClient();
        if (j.status != Status.Open) revert WrongStatus();
        if (!hasApplied[jobId][provider]) revert NoSuchApplicant();

        j.provider = provider;
        j.status = Status.Assigned;

        emit ProviderSelected(jobId, provider);
    }

    // ── Provider: submit the deliverable hash ──
    function submit(uint256 jobId, bytes32 deliverable) external {
        Job storage j = _jobs[jobId];
        if (msg.sender != j.provider) revert NotProvider();
        if (j.status != Status.Assigned) revert WrongStatus();

        j.deliverable = deliverable;
        j.status = Status.Submitted;

        emit Submitted(jobId, msg.sender, deliverable);
    }

    // ── Client: approve and release escrow to the provider ──
    function approve(uint256 jobId) external {
        Job storage j = _jobs[jobId];
        if (msg.sender != j.client) revert NotClient();
        if (j.status != Status.Submitted) revert WrongStatus();

        j.status = Status.Completed;
        uint256 amount = j.budget;
        if (!usdc.transfer(j.provider, amount)) revert TransferFailed();

        emit Completed(jobId, j.provider, amount);
    }

    // ── Client: cancel and refund ──
    /// @dev Allowed while Open (no provider yet), or after the deadline if the
    ///      provider never submitted (Assigned). Refunds the escrow to client.
    function cancel(uint256 jobId) external {
        Job storage j = _jobs[jobId];
        if (msg.sender != j.client) revert NotClient();

        if (j.status == Status.Open) {
            // ok: nobody locked in yet
        } else if (j.status == Status.Assigned) {
            if (block.timestamp < j.deadline) revert DeadlineNotReached();
        } else {
            revert WrongStatus();
        }

        j.status = Status.Cancelled;
        uint256 refund = j.budget;
        if (!usdc.transfer(j.client, refund)) revert TransferFailed();

        emit Cancelled(jobId, j.client, refund);
    }

    // ── Views ──
    function getJob(uint256 jobId) external view returns (Job memory) {
        return _jobs[jobId];
    }

    function getApplications(uint256 jobId)
        external
        view
        returns (Application[] memory)
    {
        return _applications[jobId];
    }

    function applicationCount(uint256 jobId) external view returns (uint256) {
        return _applications[jobId].length;
    }
}
