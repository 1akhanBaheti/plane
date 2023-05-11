import Router, { useRouter } from "next/router";

import useSWR, { mutate } from "swr";

// services
import projectService from "services/project.service";
// layouts
import { ProjectAuthorizationWrapper } from "layouts/auth-layout";
// contexts
import { IssueViewContextProvider } from "contexts/issue-view.context";
// helper
import { truncateText } from "helpers/string.helper";
// components
import { IssuesFilterView, IssuesView } from "components/core";
// ui
import { CustomMenu, PrimaryButton } from "components/ui";
import { BreadcrumbItem, Breadcrumbs } from "components/breadcrumbs";
// icons
import { PlusIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
// types
import type { NextPage } from "next";
// fetch-keys
import {
  INBOX_ISSUES,
  ISSUE_DETAILS,
  PROJECT_DETAILS,
  PROJECT_ISSUES_ACTIVITY,
  SUB_ISSUES,
} from "constants/fetch-keys";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import useIssuesView from "hooks/use-issues-view";
import {
  AddComment,
  IssueActivitySection,
  IssueAttachmentUpload,
  IssueAttachments,
  IssueDescriptionForm,
  IssueDetailsSidebar,
  SubIssuesList,
} from "components/issues";
import issuesService from "services/issues.service";
import inboxServices from "services/inbox.service";
import Link from "next/link";
import { IIssue } from "types";
import { useForm } from "react-hook-form";

const defaultValues = {
  name: "",
  description: "",
  description_html: "",
  estimate_point: null,
  state: "",
  assignees_list: [],
  priority: "low",
  blockers_list: [],
  blocked_list: [],
  target_date: new Date().toString(),
  issue_cycle: null,
  issue_module: null,
  labels_list: [],
};

const ProjectIssues: NextPage = () => {
  const router = useRouter();

  const [isCreateInboxModalOpen, setIsCreateInboxModalOpen] = useState(false);

  const { workspaceSlug, projectId, inboxId, issueId } = router.query;

  const activeIssueRef = useRef<HTMLDivElement>(null);

  const { reset, control, watch } = useForm<IIssue>({
    defaultValues,
  });

  const { data: inboxIssues } = useSWR(
    workspaceSlug && projectId && inboxId ? INBOX_ISSUES(inboxId as string) : null,
    workspaceSlug && projectId && inboxId
      ? () =>
          inboxServices.getInboxIssues(
            workspaceSlug as string,
            projectId as string,
            inboxId as string
          )
      : null
  );

  console.log("inboxIssues: ", inboxIssues);

  const { data: projectDetails } = useSWR(
    workspaceSlug && projectId ? PROJECT_DETAILS(projectId as string) : null,
    workspaceSlug && projectId
      ? () => projectService.getProject(workspaceSlug as string, projectId as string)
      : null
  );

  const {
    data: issueDetails,
    mutate: mutateIssueDetails,
    error: issueDetailError,
  } = useSWR<IIssue | undefined>(
    workspaceSlug && projectId && issueId ? ISSUE_DETAILS(issueId as string) : null,
    workspaceSlug && projectId && issueId
      ? () =>
          issuesService.retrieve(workspaceSlug as string, projectId as string, issueId as string)
      : null
  );

  const { data: siblingIssues } = useSWR(
    workspaceSlug && projectId && issueDetails?.parent ? SUB_ISSUES(issueDetails.parent) : null,
    workspaceSlug && projectId && issueDetails?.parent
      ? () =>
          issuesService.subIssues(
            workspaceSlug as string,
            projectId as string,
            issueDetails.parent ?? ""
          )
      : null
  );

  const submitChanges = useCallback(
    async (formData: Partial<IIssue>) => {
      if (!workspaceSlug || !projectId || !issueId) return;

      mutate(
        ISSUE_DETAILS(issueId as string),
        (prevData: IIssue) => ({
          ...prevData,
          ...formData,
        }),
        false
      );

      const payload = { ...formData };
      await issuesService
        .patchIssue(workspaceSlug as string, projectId as string, issueId as string, payload)
        .then((res) => {
          mutateIssueDetails();
          mutate(PROJECT_ISSUES_ACTIVITY(issueId as string));
        })
        .catch((e) => {
          console.error(e);
        });
    },
    [workspaceSlug, issueId, projectId, mutateIssueDetails]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!inboxIssues) return;

      if (!issueId) return;

      const currentIssueIndex = inboxIssues.findIndex((issue) => issue.issue === issueId);

      switch (e.key) {
        case "ArrowUp":
          Router.push({
            pathname: `/${workspaceSlug}/projects/${projectId}/inbox/${inboxId}`,
            query: {
              issueId:
                currentIssueIndex === 0
                  ? inboxIssues[inboxIssues.length - 1].issue
                  : inboxIssues[currentIssueIndex - 1].issue,
            },
          });
          if (activeIssueRef.current) {
            activeIssueRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "center",
            });
          }
          break;
        case "ArrowDown":
          Router.push({
            pathname: `/${workspaceSlug}/projects/${projectId}/inbox/${inboxId}`,
            query: {
              issueId:
                currentIssueIndex === inboxIssues.length - 1
                  ? inboxIssues[0].issue
                  : inboxIssues[currentIssueIndex + 1].issue,
            },
          });

          break;
        default:
          break;
      }
    },
    [workspaceSlug, projectId, issueId, inboxId, inboxIssues]
  );

  useEffect(() => {
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onKeyDown]);

  useEffect(() => {
    if (!inboxIssues || inboxIssues.length === 0) return;

    if (!workspaceSlug || !projectId || !inboxId) return;

    Router.push({
      pathname: `/${workspaceSlug}/projects/${projectId}/inbox/${inboxId}`,
      query: {
        issueId: inboxIssues[0].issue,
      },
    });
  }, [inboxIssues, workspaceSlug, projectId, inboxId]);

  return (
    <IssueViewContextProvider>
      <ProjectAuthorizationWrapper
        breadcrumbs={
          <Breadcrumbs>
            <BreadcrumbItem title="Projects" link={`/${workspaceSlug}/projects`} />
            <BreadcrumbItem
              title={`${truncateText(projectDetails?.name ?? "Project", 12)} Issues`}
            />
          </Breadcrumbs>
        }
        right={
          <div className="flex items-center gap-2">
            <PrimaryButton
              className="flex items-center gap-2"
              onClick={() => {
                const e = new KeyboardEvent("keydown", { key: "c" });
                document.dispatchEvent(e);
              }}
            >
              <PlusIcon className="h-4 w-4" />
              Add Issue
            </PrimaryButton>
          </div>
        }
      >
        <div className="grid h-full grid-cols-4 divide-x">
          <div className="col-span-1 flex h-full flex-col divide-y overflow-auto">
            <div className="sticky top-0 z-10 flex justify-between border-b border-brand-base bg-brand-surface-1 p-3">
              <p>Inbox</p>
            </div>
            <div id="issue-list-container" className="divide-y overflow-auto pb-10">
              {inboxIssues?.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/${workspaceSlug}/projects/${projectId}/inbox/${inboxId}?issueId=${issue.issue}`}
                >
                  <a>
                    <div
                      id={issue.id}
                      className={`relative h-20 cursor-pointer select-none space-y-3 py-2 px-4 hover:bg-brand-accent hover:bg-opacity-10 ${
                        issueId === issue.issue ? "bg-brand-accent bg-opacity-10" : " "
                      }`}
                    >
                      <div
                        className={`absolute left-0 top-0 h-full w-1 ${
                          issueId === issue.issue ? "bg-brand-accent" : "bg-transparent"
                        }`}
                      />
                      <div className="flex items-center justify-between">
                        <p>{issue.issue_detail.name}</p>
                        {/* <p className="text-xs text-brand-secondary">{issue.id}</p> */}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-brand-secondary">
                          {/* {issue.assignee_details[0]?.first_name ?? "No assignee"} */}
                        </p>
                        {issue.snoozed_till && (
                          <p className="text-xs text-brand-secondary">{issue.snoozed_till}</p>
                        )}
                      </div>
                    </div>
                  </a>
                </Link>
              ))}
            </div>
          </div>

          <div className="col-span-2 flex h-full flex-col overflow-auto">
            <div className="flex justify-between border-b border-brand-base p-3">
              <div className="flex gap-x-3">
                <button
                  type="button"
                  className="rounded border bg-brand-surface-1 p-1.5 hover:bg-brand-surface-2"
                  onClick={() => {
                    const e = new KeyboardEvent("keydown", { key: "ArrowUp" });
                    document.dispatchEvent(e);
                  }}
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded border bg-brand-surface-1 p-1.5 hover:bg-brand-surface-2"
                  onClick={() => {
                    const e = new KeyboardEvent("keydown", { key: "ArrowDown" });
                    document.dispatchEvent(e);
                  }}
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
                <div>
                  {(inboxIssues?.findIndex((issue) => issue.issue === issueId) ?? 0) + 1} of{" "}
                  {inboxIssues?.length}
                </div>
              </div>
              <div>actions button comes here</div>
            </div>

            <div className="h-full space-y-5 divide-y-2 divide-brand-base p-5">
              {issueDetails && (
                <div className="rounded-lg">
                  {issueDetails?.parent && issueDetails.parent !== "" ? (
                    <div className="mb-5 flex w-min items-center gap-2 whitespace-nowrap rounded bg-brand-surface-2 p-2 text-xs">
                      <Link
                        href={`/${workspaceSlug}/projects/${projectId as string}/issues/${
                          issueDetails.parent
                        }`}
                      >
                        <a className="flex items-center gap-2 text-brand-secondary">
                          <span
                            className="block h-1.5 w-1.5 rounded-full"
                            style={{
                              backgroundColor: issueDetails?.state_detail?.color,
                            }}
                          />
                          <span className="flex-shrink-0">
                            {issueDetails.project_detail.identifier}-
                            {issueDetails.parent_detail?.sequence_id}
                          </span>
                          <span className="truncate">
                            {issueDetails.parent_detail?.name.substring(0, 50)}
                          </span>
                        </a>
                      </Link>

                      <CustomMenu ellipsis optionsPosition="left">
                        {siblingIssues && siblingIssues.length > 0 ? (
                          siblingIssues.map((issue: IIssue) => (
                            <CustomMenu.MenuItem key={issue.id}>
                              <Link
                                href={`/${workspaceSlug}/projects/${projectId as string}/issues/${
                                  issue.id
                                }`}
                              >
                                <a>
                                  {issueDetails.project_detail.identifier}-{issue.sequence_id}
                                </a>
                              </Link>
                            </CustomMenu.MenuItem>
                          ))
                        ) : (
                          <CustomMenu.MenuItem className="flex items-center gap-2 whitespace-nowrap p-2 text-left text-xs text-brand-secondary">
                            No other sibling issues
                          </CustomMenu.MenuItem>
                        )}
                      </CustomMenu>
                    </div>
                  ) : null}
                  <IssueDescriptionForm issue={issueDetails} handleFormSubmit={submitChanges} />
                  <div className="mt-2 space-y-2">
                    <SubIssuesList parentIssue={issueDetails} />
                  </div>
                </div>
              )}

              {!issueDetails && issueDetailError && (
                <div>Add accept button to accept inbox issue</div>
              )}

              {issueDetails && (
                <>
                  <div className="flex flex-col gap-3 py-3">
                    <h3 className="text-lg">Attachments</h3>
                    <div className="grid  grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      <IssueAttachmentUpload />
                      <IssueAttachments />
                    </div>
                  </div>
                  <div className="space-y-5 pt-3">
                    <h3 className="text-lg text-brand-base">Comments/Activity</h3>
                    <IssueActivitySection />
                    <AddComment />
                  </div>
                </>
              )}
            </div>
          </div>

          {issueDetails && (
            <div className="col-span-1 p-5">
              <IssueDetailsSidebar
                control={control}
                issueDetail={issueDetails}
                submitChanges={submitChanges}
                watch={watch}
              />
            </div>
          )}
        </div>
      </ProjectAuthorizationWrapper>
    </IssueViewContextProvider>
  );
};

export default ProjectIssues;
