pragma solidity ^0.8.20;


contract UsageHashRegistry {
    // 장비 사용 이력 1건에 대해 블록체인에 남길 최소 메타데이터.
    // 원본 사용 이력 전체는 저장하지 않고, 해시와 기록 정보만 남긴다.
    struct UsageRecord {
        // 사용 이력 원문(payload)을 SHA-256 등으로 계산한 결과 해시.
        bytes32 usageHash;
        // 이 해시가 블록체인에 기록된 시각(block.timestamp).
        uint64 recordedAt;
        // 이 레코드를 기록한 EVM 계정 주소.
        address recorder;
        // usageId가 실제로 한 번 기록됐는지 나타내는 플래그.
        // mapping의 기본값과 구분하기 위해 사용한다.
        bool exists;
    }

    // usage_id 문자열을 키로 하여 사용 이력의 온체인 레코드를 저장한다.
    // 예: "14" -> UsageRecord(...)
    mapping(string => UsageRecord) private records;

    // 새로운 사용 이력 해시가 성공적으로 기록됐을 때 발생하는 이벤트.
    // 백엔드/인덱서/감사 도구에서 이 이벤트를 구독해 기록 성공 여부를 확인할 수 있다.
    event UsageHashRecorded(
        string usageId,
        bytes32 usageHash,
        address indexed recorder,
        uint64 recordedAt
    );

    /// @notice 사용 이력 해시를 블록체인에 1회 기록한다.
    function recordUsageHash(string calldata usageId, bytes32 usageHash) external {
        // 빈 usageId는 유효한 식별자가 아니므로 거부한다.
        require(bytes(usageId).length > 0, "usageId required");
        // 0 해시는 정상적인 기록으로 취급하지 않는다.
        require(usageHash != bytes32(0), "usageHash required");
        // 한 번 기록된 usageId는 다시 기록할 수 없다.
        // 이 제약으로 "같은 사용 이력의 해시를 나중에 바꿔치기"하는 것을 막는다.
        require(!records[usageId].exists, "usageId already recorded");

        // 블록 타임스탬프를 uint64로 저장해 공간을 줄인다.
        uint64 recordedAt = uint64(block.timestamp);

        // usageId에 대한 온체인 레코드를 저장한다.
        records[usageId] = UsageRecord({
            usageHash: usageHash,
            recordedAt: recordedAt,
            recorder: msg.sender,
            exists: true
        });

        // 외부 시스템이 기록 사실을 추적할 수 있도록 이벤트를 발행한다.
        emit UsageHashRecorded(usageId, usageHash, msg.sender, recordedAt);
    }

    /// @notice 특정 사용 이력 ID의 온체인 기록을 조회한다.
    function getUsageRecord(string calldata usageId)
        external
        view
        returns (bytes32 usageHash, uint64 recordedAt, address recorder, bool exists)
    {
        // mapping에서 레코드를 읽어 메모리로 가져온다.
        UsageRecord memory record = records[usageId];
        // 프론트/백엔드가 필요한 최소 정보만 반환한다.
        return (record.usageHash, record.recordedAt, record.recorder, record.exists);
    }
}
