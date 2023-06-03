const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('node:fs');
const { DateTime } = require("luxon");
const { convertArrayToCSV } = require('convert-array-to-csv');

const HEADER = ['name', 'description', 'url', 'reviewsRating', 'votesCount', 'followersCount', 'pricingType', 'labels', 'createdAt', 'updatedAt'];
const FILE_NAME = 'data.csv';
const URL = 'https://www.producthunt.com/';
const DEFAULT_TIMEOUT = 60000

const chromiumPath = process.argv[2] || '/opt/homebrew/bin/chromium';
let notTooOld = true;

(async () => {
    
    const browser = await puppeteer.launch({headless: 'new', executablePath: chromiumPath});
    const page = await browser.newPage();
    await page.goto(URL);
    await page.setRequestInterception(true);
    await page.setDefaultTimeout(DEFAULT_TIMEOUT);
    
    let counter = 0;
    await fs.appendFileSync(FILE_NAME, HEADER.join(',') + '\n');
    
    const previousHeight = await page.evaluate(() => document.body.scrollHeight);
    
    page.on('request', async (interceptedRequest) => {
        interceptedRequest.continue();
    })

    while (true && notTooOld) {

        await scrollDown(page);
        await timeout(2000); // wait for dom load
        
        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
        if (currentHeight === previousHeight) {
            break;
        }

        const element = await page.$(`[data-test=homepage-section-${counter}]`);
        if (element) {
            const slugs = await getSlugsFromLinks(page, element);
            const info = await getProductInfo(slugs);
            await writeInfoToFile(info.filter(Boolean));
            await page.evaluate(el => el.remove(), element);
        }
        
        counter++;
    }

    browser.close();

})()

async function timeout(delay) {
    return new Promise(resolve => setTimeout(resolve, delay))
}

async function scrollDown(page) {
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
}

async function writeInfoToFile(productsInfo) {
    try {
        const convertedArrays = convertArrayToCSV(productsInfo, {separator: ','})
        await fs.appendFileSync(FILE_NAME, convertedArrays);
    } catch (err) {
        console.error(err);
    }
}

async function getSlugsFromLinks(page, element) {
    try {
        const slugs = new Set();
        const links = await element.$$('a');
        for (const linkElement of links) {
            const href = await page.evaluate(el => el.getAttribute('href'), linkElement);
            if (href.includes('posts')) {
                slugs.add(href.split('/')[2]);
            }
            if (href.includes('products')) {
                slugs.add(href.split('/')[2].split('#')[0]);
            }    
        }
        return Array.from(slugs)
    } catch (err) {
        console.error(err);
        return [];
    }
}

async function getProductInfo(slugs) {
    try {
        return await Promise.all(slugs.map(async (slug) => {
            try {
                const res = await axios({
                    method: 'post',
                    url: 'https://www.producthunt.com/frontend/graphql',
                    data: {
                        "operationName": "PostPage",
                        "query": "query PostPage($slug:String!$badgeTypes:[BadgesTypeEnum!]){post(slug:$slug){id slug name trashedAt isArchived product{id slug passedOnePost ...ProductPageReviewSummaryFragment ...ReviewCardFragment __typename}primaryAd(kind:\"sidebar\"){id ...AdFragment __typename}redirectToProduct{id slug __typename}...PostPageHeaderFragment ...PostPageDescriptionFragment ...PostPageScheduledNoticeFragment ...PostPageLaunchDayNoticeFragment ...PostPageModerationReasonFragment ...PostPageModerationToolsFragment ...PostPageBreadcrumbFragment ...PostPageAboutFragment ...PostPageGalleryFragment ...PostPageBannerFragment ...PostPageCommentPromptFragment ...StructuredDataFromPost ...MetaTags __typename}}fragment MetaTags on SEOInterface{id meta{canonicalUrl creator description image mobileAppUrl oembedUrl robots title type author authorUrl __typename}__typename}fragment StructuredDataFromPost on Post{id structuredData __typename}fragment PostPageHeaderFragment on Post{id name tagline dailyRank createdAt ...PostThumbnail ...PostStatusIcons ...PostVoteButtonFragment ...PostPageGetItButtonFragment ...PostHeaderBadgesFragment ...PostPageActionsFragment __typename}fragment PostStatusIcons on Post{id name productState __typename}fragment PostThumbnail on Post{id name thumbnailImageUuid ...PostStatusIcons __typename}fragment PostVoteButtonFragment on Post{id featuredAt updatedAt createdAt product{id isSubscribed __typename}disabledWhenScheduled hasVoted ...on Votable{id votesCount __typename}__typename}fragment PostPageGetItButtonFragment on Post{id isAvailable productState links{id redirectPath storeName websiteName devices __typename}__typename}fragment PostHeaderBadgesFragment on Post{id badges(first:3 types:$badgeTypes){edges{node{...ProductBadgeFragment __typename}__typename}__typename}__typename}fragment ProductBadgeFragment on Badge{...on TopPostBadge{id ...ProductTopPostBadgeFragment __typename}...on GoldenKittyAwardBadge{id ...ProductGoldenKittyBadgeFragment __typename}...on TopPostTopicBadge{id ...ProductTopPostTopicBadgeFragment __typename}__typename}fragment ProductTopPostBadgeFragment on TopPostBadge{id post{id name __typename}position period date __typename}fragment ProductGoldenKittyBadgeFragment on GoldenKittyAwardBadge{id year position category post{id name __typename}__typename}fragment ProductTopPostTopicBadgeFragment on TopPostTopicBadge{id __typename}fragment PostPageActionsFragment on Post{id slug userId canManage __typename}fragment PostPageDescriptionFragment on Post{id slug tagline description pricingType isArchived createdAt featuredAt ...ShareModalSubjectFragment ...PostThumbnail ...PostPromoCodeFragment product{id slug name tagline logoUuid ...CollectionAddButtonFragment __typename}topics(first:3){edges{node{id slug name __typename}__typename}totalCount __typename}__typename}fragment PostPromoCodeFragment on Post{id promo{text code __typename}__typename}fragment ShareModalSubjectFragment on Shareable{id url ...FacebookShareButtonFragment __typename}fragment FacebookShareButtonFragment on Shareable{id url __typename}fragment CollectionAddButtonFragment on Product{id name description ...ProductItemFragment __typename}fragment ProductItemFragment on Product{id slug name tagline followersCount reviewsCount topics(first:2){edges{node{id slug name __typename}__typename}__typename}...ProductFollowButtonFragment ...ProductThumbnailFragment ...ProductMuteButtonFragment ...FacebookShareButtonV6Fragment ...ReviewStarRatingCTAFragment __typename}fragment ProductThumbnailFragment on Product{id name logoUuid isNoLongerOnline __typename}fragment ProductFollowButtonFragment on Product{id followersCount isSubscribed __typename}fragment ProductMuteButtonFragment on Product{id isMuted __typename}fragment FacebookShareButtonV6Fragment on Shareable{id url __typename}fragment ReviewStarRatingCTAFragment on Product{id slug name isMaker reviewsRating __typename}fragment PostPageScheduledNoticeFragment on Post{id slug name createdAt canCreateUpcomingEvent canViewUpcomingEventCreateBtn upcomingEvent{id canEdit approved __typename}product{id name slug canEdit ...TeamRequestCTAFragment __typename}__typename}fragment TeamRequestCTAFragment on Product{id slug name websiteUrl websiteDomain isClaimed isViewerTeamMember viewerPendingTeamRequest{id __typename}__typename}fragment PostPageLaunchDayNoticeFragment on Post{id slug createdAt isMaker isHunter product{id slug __typename}__typename}fragment PostPageModerationReasonFragment on Post{id moderationReason{reason moderator{id name headline username __typename}__typename}__typename}fragment PostPageModerationToolsFragment on Post{id name slug featuredAt createdAt product{id __typename}...ModerationChangeProductFormPostFragment __typename}fragment ModerationChangeProductFormPostFragment on Post{id name primaryLink{id url __typename}product{id ...ModerationChangeProductFormProductFragment __typename}__typename}fragment ModerationChangeProductFormProductFragment on Product{id name slug tagline cleanUrl websiteUrl ...ProductThumbnailFragment __typename}fragment PostPageBreadcrumbFragment on Post{id slug name product{id slug __typename}__typename}fragment PostPageAboutFragment on Post{id name slug votesCount commentsCount dailyRank weeklyRank createdAt featuredAt canManage product{id name slug tagline reviewersCount reviewsCount followersCount firstPost{id createdAt __typename}...ProductThumbnailFragment ...ProductFollowButtonFragment ...ReviewStarRatingCTAFragment __typename}user{id name username ...UserImage __typename}makers{id name username ...UserImage __typename}topics(first:3){edges{node{id name slug __typename}__typename}__typename}__typename}fragment UserImage on User{id name username avatarUrl __typename}fragment PostPageGalleryFragment on Post{id name media{id originalHeight originalWidth imageUuid mediaType metadata{url videoId platform __typename}__typename}__typename}fragment PostPageBannerFragment on Post{id isArchived featuredAt createdAt product{id slug name postsCount __typename}__typename}fragment AdFragment on AdChannel{id post{id slug name updatedAt commentsCount ...PostVoteButtonFragment __typename}ctaText name tagline thumbnailUuid url __typename}fragment PostPageCommentPromptFragment on Post{id name isArchived commentPrompt ...PostThumbnail __typename}fragment ProductPageReviewSummaryFragment on Product{id name slug postsCount reviewsCount reviewersCount reviewsRating isMaker reviewers(first:3){edges{node{id username name ...UserImage __typename}__typename}__typename}...ReviewCTAPromptFragment __typename}fragment ReviewCTAPromptFragment on Product{id isMaker viewerReview{id __typename}...ReviewCTASharePromptFragment __typename}fragment ReviewCTASharePromptFragment on Product{id name tagline slug ...ProductThumbnailFragment ...FacebookShareButtonFragment __typename}fragment ReviewCardFragment on Product{id name isMaker ...ReviewCTAPromptFragment __typename}",
                        "variables": {
                            "slug": slug
                        }
                    }
                });
                const data = res?.data?.data?.post;

                if (!data) {
                    return;
                } 
    
                const { updatedAt, createdAt } = data;
                const topics = res?.data?.data?.post?.topics?.edges.map(el => el?.node?.slug).join('_');

                if (DateTime.fromISO('2021-01-01') > DateTime.fromISO(updatedAt)) {
                    notTooOld = false;
                    return;
                }

                console.log('Processed product name:', data?.name, 'votes:', data?.votesCount);
                return [
                    checkPresence(data?.product?.name),
                    checkPresence(data?.description),
                    checkPresence(data?.url),
                    checkPresence(data?.product?.reviewsRating),
                    checkPresence(data?.votesCount),
                    checkPresence(data?.product?.followersCount),
                    checkPresence(data?.pricingType),
                    checkPresence(topics),
                    DateTime.fromISO(createdAt).setLocale('ru').toLocaleString(DateTime.DATE_MED),
                    DateTime.fromISO(updatedAt).setLocale('ru').toLocaleString(DateTime.DATE_MED)
                ];
            } catch (err) {
                console.error(err);
                return null
            }
        }));
    } catch (err) {
        console.error(err);
        return [];
    }
}

function checkPresence(val) {
    return val || 'NOT_FOUND';
}
