import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthUser } from "@/lib/auth";
import { exec, ChildProcess } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// Module-level map to store active processes per user
const activeProcesses = new Map<string, ChildProcess>();

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);

    // 1. Get naverBlogId from profile database
    const { data: userProfile, error: selectError } = await supabaseAdmin
      .from("User")
      .select("naverBlogId")
      .eq("id", user.id)
      .single();

    if (selectError || !userProfile || !userProfile.naverBlogId) {
      return NextResponse.json(
        { error: "블로그 ID가 설정되어 있지 않습니다. 회원정보 수정에서 블로그 ID를 먼저 설정해주세요." },
        { status: 400 }
      );
    }

    const naverBlogId = userProfile.naverBlogId.trim();

    // 2. Pre-install dependencies
    try {
      console.log("Installing/verifying python dependencies...");
      await execAsync("python -m pip install selenium webdriver-manager");
    } catch (e) {
      try {
        await execAsync("pip install selenium webdriver-manager");
      } catch (e2) {
        console.warn("Dependency pre-install warning:", e2);
      }
    }

    // 3. Resolve paths
    const scriptPath = path.join(process.cwd(), "scripts", "test_selenium.py");

    console.log(`Running selenium test script for blog ID: ${naverBlogId}`);
    
    // We execute the python script in a promise so we can return response when finished,
    // but save the ChildProcess handle inside activeProcesses map.
    return new Promise<NextResponse>((resolve) => {
      const command = `python "${scriptPath}" ${naverBlogId}`;
      const child = exec(command, async (pythonError, stdout, stderr) => {
        // If this process was aborted, activeProcesses entry for this user might already be removed
        if (!activeProcesses.has(user.id)) {
          resolve(NextResponse.json({ aborted: true, success: false, error: "Aborted" }));
          return;
        }

        activeProcesses.delete(user.id);

        if (pythonError) {
          console.log("Python command failed, trying py command fallback...");
          const fallbackCommand = `py "${scriptPath}" ${naverBlogId}`;
          const fallbackChild = exec(fallbackCommand, (fallbackError, fStdout, fStderr) => {
            if (!activeProcesses.has(user.id)) {
              resolve(NextResponse.json({ aborted: true, success: false, error: "Aborted" }));
              return;
            }
            activeProcesses.delete(user.id);

            if (fallbackError) {
              console.error("Selenium test execution failed:", fallbackError);
              resolve(NextResponse.json(
                { 
                  error: "셀레니움 테스트 실행 중 오류가 발생했습니다. 파이썬 및 크롬 드라이버 상태를 확인해주세요.", 
                  details: fallbackError.message,
                  stderr: fallbackError.stderr || ""
                },
                { status: 500 }
              ));
            } else {
              console.log("Selenium fallback script executed successfully");
              resolve(NextResponse.json({
                success: true,
                message: "셀레니움 블로그 쓰기 테스트를 완료했습니다. 임시 저장 글이 생성되었습니다.",
                stdout: fStdout,
                stderr: fStderr
              }));
            }
          });
          
          activeProcesses.set(user.id, fallbackChild);
        } else {
          console.log("Selenium script executed successfully");
          resolve(NextResponse.json({
            success: true,
            message: "셀레니움 블로그 쓰기 테스트를 완료했습니다. 임시 저장 글이 생성되었습니다.",
            stdout,
            stderr
          }));
        }
      });

      activeProcesses.set(user.id, child);
    });

  } catch (error: any) {
    console.error("Selenium test API route error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAuthUser(request);

    const child = activeProcesses.get(user.id);
    if (!child) {
      return NextResponse.json({ error: "실행 중인 테스트가 없습니다." }, { status: 404 });
    }

    console.log(`Killing selenium process (PID: ${child.pid}) for user ${user.id}`);

    // Terminate process tree to prevent orphaned chromedriver/chrome instances on Windows
    if (process.platform === "win32") {
      exec(`taskkill /F /T /PID ${child.pid}`);
    } else {
      child.kill("SIGKILL");
    }

    activeProcesses.delete(user.id);

    return NextResponse.json({ success: true, message: "테스트가 중단되었습니다." });
  } catch (error: any) {
    console.error("Abort selenium process error:", error);
    const status = error.message?.includes("Unauthorized") || error.message?.includes("Missing") ? 401 : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }
}
