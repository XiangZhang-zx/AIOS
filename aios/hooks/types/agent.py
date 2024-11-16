from pydantic import BaseModel
from typing import Any, TypeAlias, Callable, Optional, List, Union

class AgentParserParams(BaseModel):
    llm: Any
    query: str


class FactoryParams(BaseModel):
    log_mode: str = ("console",)
    max_workers: int = 500


class AgentSubmitDeclaration(BaseModel):
    agent_name: str
    task_input: Union[str, int, float, dict, tuple, list]
    attachments: Optional[List[str]] = None