pragma solidity ^0.8.20;

contract UsageRecordRegistry {
    struct UsageRecord {
        uint64 checkoutUserId;
        uint64 returnUserId;
        string tagId;
        string checkoutLocation;
        uint64 checkoutAt;
        string returnLocation;
        uint64 returnedAt;
        uint64 recordedAt;
        address recorder;
        bool exists;
    }

    mapping(string => UsageRecord) private records;

    event UsageRecordStored(
        string usageId,
        uint64 checkoutUserId,
        uint64 returnUserId,
        string tagId,
        string checkoutLocation,
        uint64 checkoutAt,
        string returnLocation,
        uint64 returnedAt,
        address indexed recorder,
        uint64 recordedAt
    );

    function recordUsageRecord(
        string calldata usageId,
        uint64 checkoutUserId,
        uint64 returnUserId,
        string calldata tagId,
        string calldata checkoutLocation,
        uint64 checkoutAt,
        string calldata returnLocation,
        uint64 returnedAt
    ) external {
        require(bytes(usageId).length > 0, "usageId required");
        require(bytes(tagId).length > 0, "tagId required");
        require(checkoutUserId > 0, "checkoutUserId required");
        require(returnUserId > 0, "returnUserId required");
        require(checkoutAt > 0, "checkoutAt required");
        require(returnedAt > 0, "returnedAt required");
        require(returnedAt >= checkoutAt, "returnedAt before checkoutAt");
        require(!records[usageId].exists, "usageId already recorded");

        uint64 recordedAt = uint64(block.timestamp);

        records[usageId] = UsageRecord({
            checkoutUserId: checkoutUserId,
            returnUserId: returnUserId,
            tagId: tagId,
            checkoutLocation: checkoutLocation,
            checkoutAt: checkoutAt,
            returnLocation: returnLocation,
            returnedAt: returnedAt,
            recordedAt: recordedAt,
            recorder: msg.sender,
            exists: true
        });

        emit UsageRecordStored(
            usageId,
            checkoutUserId,
            returnUserId,
            tagId,
            checkoutLocation,
            checkoutAt,
            returnLocation,
            returnedAt,
            msg.sender,
            recordedAt
        );
    }

    function getUsageRecord(string calldata usageId)
        external
        view
        returns (
            uint64 checkoutUserId,
            uint64 returnUserId,
            string memory tagId,
            string memory checkoutLocation,
            uint64 checkoutAt,
            string memory returnLocation,
            uint64 returnedAt,
            uint64 recordedAt,
            address recorder,
            bool exists
        )
    {
        UsageRecord memory record = records[usageId];
        return (
            record.checkoutUserId,
            record.returnUserId,
            record.tagId,
            record.checkoutLocation,
            record.checkoutAt,
            record.returnLocation,
            record.returnedAt,
            record.recordedAt,
            record.recorder,
            record.exists
        );
    }
}
