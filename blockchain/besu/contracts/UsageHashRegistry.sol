// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title UsageHashRegistry
/// @notice Stores one immutable usage hash per usage ID for demo and integration work.
contract UsageHashRegistry {
    struct UsageRecord {
        bytes32 usageHash;
        uint64 recordedAt;
        address recorder;
        bool exists;
    }

    mapping(string => UsageRecord) private records;

    event UsageHashRecorded(
        string usageId,
        bytes32 usageHash,
        address indexed recorder,
        uint64 recordedAt
    );

    function recordUsageHash(string calldata usageId, bytes32 usageHash) external {
        require(bytes(usageId).length > 0, "usageId required");
        require(usageHash != bytes32(0), "usageHash required");
        require(!records[usageId].exists, "usageId already recorded");

        uint64 recordedAt = uint64(block.timestamp);

        records[usageId] = UsageRecord({
            usageHash: usageHash,
            recordedAt: recordedAt,
            recorder: msg.sender,
            exists: true
        });

        emit UsageHashRecorded(usageId, usageHash, msg.sender, recordedAt);
    }

    function getUsageRecord(string calldata usageId)
        external
        view
        returns (bytes32 usageHash, uint64 recordedAt, address recorder, bool exists)
    {
        UsageRecord memory record = records[usageId];
        return (record.usageHash, record.recordedAt, record.recorder, record.exists);
    }
}
