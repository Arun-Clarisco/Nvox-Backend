const Config = require("../../Config/config")
const userModule = require("../../Modules/userModule/userModule")
const kycUserData = require("../../Modules/userModule/KycVerification")
const userIndiviuals = require("../../Modules/userModule/IndividualUserForm");
const bussinessUser = require('../../Modules/userModule/BussinesUserForm')
const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');

// const applicant = "66fa44c5abb6d6254a51881f";
const SUMSUB_APP_TOKEN = Config.APP_Token
const SUMSUB_SECRET_KEY = Config.Secret_Key
const SUMSUB_BASE_URL = 'https://api.sumsub.com';

const createSignature = (url, method, data = null) => {
    // console.log('Creating a signature for the request...');

    var ts = Math.floor(Date.now() / 1000);
    const signature = crypto.createHmac('sha256', SUMSUB_SECRET_KEY);
    signature.update(ts + method + url);

    if (data instanceof FormData) {
        signature.update(data.getBuffer());
    } else if (data) {
        signature.update(JSON.stringify(data));
    }

    const headers = {
        'X-App-Access-Ts': ts,
        'X-App-Access-Sig': signature.digest('hex'),
        'X-App-Token': SUMSUB_APP_TOKEN,
        'Accept': '*/*',
        'Content-Type': 'application/json',
    };

    return headers;
};

const createApplicant = async (externalUserId, levelName) => {
    // console.log("Creating new applicant...");
    const url = '/resources/applicants?levelName=' + encodeURIComponent(levelName);
    const method = 'POST';
    const body = {
        externalUserId: externalUserId
    };
    const headers = createSignature(url, method, body);

    try {
        const response = await axios({
            url: SUMSUB_BASE_URL + url,
            method: method,
            headers: headers,
            data: body,
        });

        return response.data;
    } catch (error) {
        console.error("Error creating applicant:", error.response ? error.response.data : error.message);
        throw error;
    }
};

// Generate SDK LINK
const generateSDKlink = async (externalUserId, levelName) => {

    var url = '/resources/sdkIntegrations/levels/' + encodeURIComponent(levelName) + '/websdkLink?externalUserId=' + encodeURIComponent(externalUserId) + '&ttlInSecs=1800';
    var method = 'POST';

    const headers = createSignature(url, method);

    try {
        const response = await axios({
            url: SUMSUB_BASE_URL + url,
            method: method,
            headers: headers
        });

        return response.data;
    } catch (error) {
        console.error("Error creating applicant:", error.response ? error.response.data : error.message);
        throw error;
    }
}


const generateReusableSdkLink = async (applicantID, levelName) => {

    var url = '/resources/sdkIntegrations/levels/' + encodeURIComponent(levelName) + '/websdkLink?externalUserId=' + encodeURIComponent(applicantID) + '&ttlInSecs=1800';
    var method = 'POST';

    const headers = createSignature(url, method);

    try {
        const response = await axios({
            url: SUMSUB_BASE_URL + url,
            method: method,
            headers: headers
        });

        return response.data;
    } catch (error) {
        console.error("Error creating applicant:", error.response ? error.response.data : error.message);
        throw error;
    }
}

const getAddressFromSumSub = async (applicant) => {
    try {
        var url = `/resources/applicants/${applicant}/one`;
        var method = 'GET';
        const headers = createSignature(url, method);
        const response = await axios({
            url: SUMSUB_BASE_URL + url,
            method: method,
            headers: headers
        });
        // console.log(response.data.info)
        return response.data.info
    } catch (error) {
        console.log(error)
    }
}

const verifyApplicantStatus = async (applicant) => {
    var url = `/resources/applicants/${applicant}/status`;
    var method = 'GET';
    const headers = createSignature(url, method);

    try {
        const response = await axios({
            url: SUMSUB_BASE_URL + url,
            method: method,
            headers: headers
        });
        return response.data;
    } catch (error) {
        console.error("Error creating applicant:", error.response ? error.response.data : error.message);
        throw error;
    }
}


class KycVerification {
    verifyKyc = async (req, res) => {
        const id = res.locals.user_id;

        try {
            const userDetail = await userModule.findById({ _id: id });
            const userEmail = userDetail.email.split("@")[0]
            const externalUserId = userEmail + Math.random().toString(36).substr(2, 9);
            const levelName = Config.Level_Name;
            const kycData = await kycUserData.findOne({ user_id: id });
            if (kycData.kyc_Status == "1" && (kycData.sdk_verification.sdkStatus == "pending" || kycData.sdk_verification.sdkStatus == "onHold" || kycData.sdk_verification.sdkStatus == "init" || (kycData.sdk_verification.sdkStatus == "completed" && kycData.sdk_verification.reviewRejectType == "RETRY" && kycData.sdk_verification.reviewResult == "RED"))) {
                const applicant = kycData.sdk_verification.externalUserID;
                const sdkLink = await generateReusableSdkLink(applicant, levelName);
                if (sdkLink) {
                    res.send({ status: true, message: "The Link Generated", sdkLink })
                } else {
                    res.send({ status: false, message: "Failed to Create the Applicant ID" })
                }
            } else if (kycData.kyc_Status != "2") {
                const response = await createApplicant(externalUserId, levelName);
                // console.log("createApplicant---Response:\n", response);

                const applicantId = response.id;
                // console.log("ApplicantID: ", applicantId);

                const sdkLink = await generateSDKlink(externalUserId, levelName)
                // console.log('sdkLink', sdkLink)
                if (sdkLink) {
                    const verifyStatus = await verifyApplicantStatus(applicantId)
                    const createStatus = await kycUserData.findOneAndUpdate({ user_id: id }, {
                        $set: {
                            'sdk_verification.externalUserID': externalUserId,
                            'sdk_verification.applicantID': applicantId,
                            'sdk_verification.sdkStatus': verifyStatus.reviewStatus,
                            'sdk_verification.reviewResult': verifyStatus?.reviewResult?.reviewAnswer || "-",
                            'sdk_verification.reviewRejectType': verifyStatus?.reviewResult?.reviewRejectType || "-",
                            'current_Address.0.sumsub_status': false,
                        },
                    },
                        { new: true })
                    if (createStatus) {
                        res.send({ status: true, message: "The Link Generated", sdkLink })
                    } else {
                        res.send({ status: false, message: "Failed to Create the Applicant ID" })
                    }
                } else {
                    res.send({ status: false, message: "Failed to generate the link" })
                }
            }
        } catch (error) {
            console.error("Error occurred:", error);
        }
    };

    statusCheck = async (req, res) => {
        const id = res.locals.user_id;
        // console.log("statusCheck=User ID:", id);

        try {
            const findapplicantID = await kycUserData.findOne({ user_id: id })

            if (!findapplicantID) {
                return res.send({ status: false, message: "User not found" });
            }
            if (findapplicantID.sdk_verification.applicantID == undefined) {
                return res.send({ status: false, message: "Cannot Find the Applicant ID" })
            }
            const applicant = findapplicantID.sdk_verification.applicantID
            // console.log("Applicant ID:", applicant);

            const verifyStatus = await verifyApplicantStatus(applicant)

            if (verifyStatus.attemptCnt > 0) {
                if (verifyStatus.reviewStatus == "completed" && verifyStatus.reviewResult.reviewAnswer == "GREEN") {
                    const updateStatus = await kycUserData.findOneAndUpdate({ user_id: id }, {
                        $set: {
                            kyc_Status: 2,
                            'sdk_verification.sdkStatus': verifyStatus.reviewStatus,
                            'sdk_verification.reviewResult': verifyStatus.reviewResult.reviewAnswer,
                            'sdk_verification.reviewRejectType': "Approved",
                        },
                    }, { new: true })
                    if (updateStatus) {
                        const status = findapplicantID?.current_Address?.[0]?.sumsub_status;
                        if (applicant && !status) {
                            const getAddressData = await getAddressFromSumSub(applicant);
                            if (getAddressData?.addresses) {
                                const kycData = {
                                    current_Address: [{
                                        address_1: getAddressData?.addresses?.[0]?.streetEn,
                                        address_2: getAddressData?.addresses?.[0]?.subStreetEn,
                                        resident_country: getAddressData?.addresses?.[0]?.country,
                                        state: getAddressData?.addresses?.[0]?.stateEn,
                                        city: getAddressData?.addresses?.[0]?.townEn,
                                        zip_code: getAddressData?.addresses[0]?.postCode,
                                        sumsub_status: true
                                    }]
                                }
                                const updateKycData = await kycUserData.findOneAndUpdate(
                                    { user_id: id },
                                    { $set: kycData },
                                    { new: true }
                                );
                            }
                        }
                        res.send({ status: true, message: "The KYC Verfication Completed", verifyStatus })

                    }
                } else {
                    if (verifyStatus?.reviewResult?.reviewRejectType == "FINAL" && verifyStatus?.reviewResult?.reviewAnswer == "RED" && verifyStatus.reviewStatus == "completed") {
                        await kycUserData.findOneAndUpdate({ user_id: id }, {
                            $set: {
                                kyc_Status: 0,
                                'sdk_verification.sdkStatus': verifyStatus.reviewStatus,
                                'sdk_verification.reviewResult': verifyStatus?.reviewResult?.reviewAnswer || "RED",
                                'sdk_verification.reviewRejectType': verifyStatus?.reviewResult?.reviewRejectType || "RETRY",
                            }
                        }, { new: true })
                        res.send({ status: false, message: "KYC Verification is Pending", verifyStatus })
                    } else {
                        await kycUserData.findOneAndUpdate({ user_id: id }, {
                            $set: {
                                kyc_Status: 1,
                                'sdk_verification.sdkStatus': verifyStatus.reviewStatus,
                                'sdk_verification.reviewResult': verifyStatus?.reviewResult?.reviewAnswer || "RED",
                                'sdk_verification.reviewRejectType': verifyStatus?.reviewResult?.reviewRejectType || "RETRY",
                            }
                        }, { new: true })
                        res.send({ status: false, message: "KYC Verification is Pending", verifyStatus })
                    }
                }

            }
            else {
                await kycUserData.findOneAndUpdate({ user_id: id }, {
                    $set: {
                        'kyc_Status': 1,
                        'sdk_verification.sdkStatus': verifyStatus?.reviewStatus || "Rejected",
                        'sdk_verification.reviewResult': "RED",
                        'sdk_verification.reviewRejectType': "RETRY",
                    }
                }, { new: true })
                res.send({ status: false, message: "Kindly Complete the KYC", })
            }

        } catch (error) {
            console.log("verify---status---error", error);
        }

    }


    // statusCheck = async (req, res) => {
    //     const id = res.locals.user_id;
    //     // console.log("statusCheck=User ID:", id);

    //     try {
    //         const findapplicantID = await kycUserData.findOne({ user_id: id })
    //         // console.log("findapplicantID:", findapplicantID);

    //         if (!findapplicantID) {
    //             return res.send({ status: false, message: "User not found" });
    //         }
    //         if (findapplicantID.sdk_verification.applicantID == undefined) {
    //             return res.send({ status: false, message: "Cannot Find the Applicant ID" })
    //         }
    //         const applicant = findapplicantID.sdk_verification.applicantID
    //         // console.log("Applicant ID:", applicant);

    //         const verifyStatus = await verifyApplicantStatus(applicant)
    //         console.log("verifyStatus:", verifyStatus);

    //         if (verifyStatus.attemptCnt > 0) {
    //             if (verifyStatus.reviewStatus == "completed" && verifyStatus.reviewResult.reviewAnswer == "GREEN") {
    //                 const updateStatus = await kycUserData.findOneAndUpdate({ user_id: id }, {
    //                     $set: {
    //                         kyc_Status: 2,
    //                         'sdk_verification.sdkStatus': verifyStatus.reviewStatus,
    //                         'sdk_verification.reviewResult': verifyStatus.reviewResult.reviewAnswer,
    //                         'sdk_verification.reviewRejectType': "Approved",
    //                     },
    //                 }, { new: true })
    //                 if (updateStatus) {
    //                     res.send({ status: true, message: "The KYC Verfication Completed", verifyStatus })
    //                 }
    //             } else {
    //                 await kycUserData.findOneAndUpdate({ user_id: id }, {
    //                     $set: {
    //                         kyc_Status: 1,
    //                         'sdk_verification.sdkStatus': verifyStatus.reviewStatus,
    //                         'sdk_verification.reviewResult': verifyStatus?.reviewResult?.reviewAnswer || "-",
    //                         'sdk_verification.reviewRejectType': verifyStatus?.reviewResult?.reviewRejectType || "-",
    //                     }
    //                 }, { new: true })
    //                 res.send({ status: false, message: "KYC Verification is Pending", verifyStatus })
    //             }

    //         }
    //         else {
    //             await kycUserData.findOneAndUpdate({ user_id: id }, {
    //                 $set: {
    //                     'kyc_Status': 1,
    //                     'sdk_verification.sdkStatus': verifyStatus?.reviewStatus || "Rejected",
    //                     'sdk_verification.reviewResult': "-",
    //                     'sdk_verification.reviewRejectType': "-",
    //                 }
    //             }, { new: true })
    //             let message = verifyStatus?.reviewStatus == "init" ? "Kindly Complete the KYC" : "KYC Verification is Pending";
    //             res.send({ status: false, message: message })
    //         }

    //     } catch (error) {
    //         console.log("verify---status---error", error);
    //     }

    // }
}

module.exports = new KycVerification;