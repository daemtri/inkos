 两个服务分别在仓库根目录跑：

   ```bash
     # API 服务（4569 端口，需在 packages/studio 目录下）
     cd packages/studio
     INKOS_STUDIO_PORT=4569 INKOS_PROJECT_ROOT=../../test-project pnpm exec tsx watch --clear-screen=false src/api/index.ts
   ```

   ```bash
     # 前端（4567 端口，另开一个终端）
     pnpm --filter @actalk/inkos-studio dev:client
   ```