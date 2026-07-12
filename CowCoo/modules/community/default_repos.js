export const DefaultRepos = {
    
    "何日见": {
        default: true,
        order: 1,
        aboutDisplay: "喵喵插件原神星铁高质量面板图",
        url: "https://github.com/herijian1/characterpic1",
        canonicalId: "herijian1/characterpic1",
        mirrors: [
            "https://gitcode.com/herijian/characterpic1",
            "https://gitee.com/herijian/characterpic1"
        ]
    },
    
    "夜": {
        url: "https://github.com/ye3011/normal-character",
        default: true,
        order: 2,
        aboutDisplay: "喵喵插件面板图",
        repoType: "超大型",
        estSize: "9GB+",
        estTraffic: "50GB+",
        deployMode: "direct",
        ultraLarge: {
            maxConcurrent: 2,
            forceCleanupMs: 10000,
            diskSpaceExemptGB: 100
        }
    },

    "阿修": {
        default: true,
        order: 3,
        aboutDisplay: "Yunzai的原神&星铁面板图图库",
        url: "https://github.com/AxiuCN/miao-plugin-ProfileImg",
        canonicalId: "axiucn/miao-plugin-profileimg"
    },

};

export default DefaultRepos;``