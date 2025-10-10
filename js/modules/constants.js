// Social media platform configurations
export const SOCIAL_PLATFORMS = {
    Facebook: { icon: "fa-brands fa-facebook", title: "Facebook" },
    Instagram: { icon: "fa-brands fa-instagram", title: "Instagram" },
    Bluesky: { icon: "fa-solid fa-b", title: "Bluesky" },
    Tiktok: { icon: "fa-brands fa-tiktok", title: "TikTok" },
    Twitter: { icon: "fa-brands fa-twitter", title: "Twitter" },
    Youtube: { icon: "fa-brands fa-youtube", title: "YouTube" },
    Website: { icon: "fa-solid fa-globe", title: "Website" }
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const VALID_ORDINALS = ["first", "second", "third", "fourth", "fifth", "last", "every"];
export const ARTICLES = ["the ", "a ", "an ", "la ", "el ", "le "];

// Default venue structure
export const DEFAULT_VENUE = {
    "VenueName": "New Venue",
    "Dedicated": false,
    "Address": {
        "Street": "",
        "City": "",
        "State": "",
        "Zip": ""
    },
    "Timeframe": {
        "StartDate": null,
        "EndDate": null
    },
    "KJ": {
        "Host": "",
        "Company": "",
        "KJsocials": {
            "Facebook": null,
            "Instagram": null,
            "Twitter": null,
            "Website": null,
            "Bluesky": null,
            "Tiktok": null,
            "Youtube": null
        }
    },
    "socials": {
        "Facebook": null,
        "Instagram": null,
        "Website": null,
        "Twitter": null,
        "Bluesky": null,
        "Tiktok": null,
        "Youtube": null
    },
    "schedule": []
};