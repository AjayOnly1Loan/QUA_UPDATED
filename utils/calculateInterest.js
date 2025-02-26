import moment from "moment"
import Collection from "../models/Collection.js";

const BATCH_SIZE = 500;


export const calculateInterest = async (msg) => {
    console.log('cron is running', msg, new Date())

    const collections = await Collection.aggregate([
        {
            $lookup: {
                from: "closes",
                localField: "close",
                foreignField: "_id",
                as: "closedData"
            }
        },
        {
            $unwind: {
              path: "$closedData",
              preserveNullAndEmptyArrays: true // In case there is no match
            }
          },
          {
            $match: {
              "closedData.isActive": true, // Ensure correct field reference
              "closedData.isClosed": false
            }
          },

        {
            $lookup: {
                from: "disbursals",
                localField: "disbursal",
                foreignField: "_id",
                as: "disbursalData"
            }
        },
        {
            $unwind: {
                path: "$disbursalData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "sanctions",
                localField: "disbursalData.sanction",
                foreignField: "_id",
                as: "sanctionData"
            }
        },

        {
            $unwind: {
                path: "$sanctionData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "camdetails",
                localField: "camDetails",
                foreignField: "_id",
                as: "camData"
            }
        },
        {
            $unwind: {
                path: "$camData",
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                penalty: 1,
                interest: 1,
                loanNo: 1,
                principalAmount: 1,
                penalRate: 1,
                dpd: 1,
                sanctionedAmount:
                    "$camData.loanRecommended",
                roi: "$camData.roi",
                tenure: "$camData.eligibleTenure",
                sanctionDate: "$sanctionData.sanctionDate",
                disbursedDate: "$camData.disbursalDate"
            }
        }
    ]);



    const collectionBulk = []
    let count = 0


    for (let collectionData of collections) {
        count++
        let { roi, tenure, sanctionDate, principalAmount, penalty, disbursedDate, interest, dpd, loanNo } = collectionData
        let penalRate = 2

        console.log('cronnnnn', !disbursedDate, !tenure, !roi, loanNo, !principalAmount, principalAmount)


        if (!disbursedDate || !tenure || !roi || !principalAmount) return "Insuficiant Data!";


        let localDisbursedDate = moment(disbursedDate).startOf("day");
        const today = moment().startOf("day");


        const elapseDays = today.diff(localDisbursedDate, "days") + 1
        if (elapseDays > tenure) {
            dpd = elapseDays - tenure
            penalty = Number((principalAmount * (penalRate / 100) * dpd).toFixed(2))
        } else {
            interest = Number((principalAmount * (roi / 100) * elapseDays).toFixed(2))
        }

        collectionBulk.push({
            updateOne: {
                filter: { _id: collectionData._id },
                update: {
                    $set: {
                        interest: Number(interest.toFixed(2)),
                        penalty: Number(penalty.toFixed(2)),
                        dpd,
                        outstandingAmount: Number(((principalAmount || 0) + (interest || 0) + (penalty || 0)).toFixed(2))
                    }
                }
            }
        });

        if (collectionBulk.length > BATCH_SIZE) {
            await Collection.bulkWrite(collectionBulk);
            collectionBulk.length = 0

        }

    }
    console.log("count ", count)

    if (collectionBulk.length > 0) {
        await Collection.bulkWrite(collectionBulk);
    }


}