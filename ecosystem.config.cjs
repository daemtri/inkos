// InkOS Studio — PM2 启动配置
// 用法：
//   npm i -g pm2
//   pnpm build                       # 先构建，生成 packages/studio/dist
//   pm2 start ecosystem.config.cjs
//   pm2 save && pm2 startup          # 开机自启
//
// 环境变量覆盖：
//   INKOS_PROJECT_ROOT=/mnt/data/inkos-project INKOS_STUDIO_PORT=4567 pm2 start ecosystem.config.cjs

const projectRoot = process.env.INKOS_PROJECT_ROOT || "/mnt/data/inkos-project";

module.exports = {
  apps: [
    {
      name: "inkos-studio",
      script: "packages/studio/dist/api/index.js",
      args: [projectRoot],
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        INKOS_STUDIO_PORT: process.env.INKOS_STUDIO_PORT || "4567",
      },
      // 写章节是长任务，内存给足；异常退出自动拉起
      max_memory_restart: "2G",
      max_restarts: 10,
      restart_delay: 3000,
      // 日志带时间戳，便于排查
      time: true,
    },
  ],
};
